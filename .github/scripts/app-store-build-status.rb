# frozen_string_literal: true
require "base64"
require "json"
require "net/http"
require "openssl"
require "uri"
class AppStoreApi
  class Error < StandardError; end
  BASE = "https://api.appstoreconnect.apple.com"
  def initialize(token:, request: nil, sleeper: ->(seconds) { sleep seconds })
    @token, @request, @sleeper = token, request || method(:http_get), sleeper
  end
  def pages(path, query)
    uri = URI.join(BASE, path)
    uri.query = URI.encode_www_form(query)
    items = []
    expected_total = nil
    visited = {}
    loop do
      raise Error, "Untrusted App Store Connect pagination URL" unless uri.scheme == "https" && uri.host == "api.appstoreconnect.apple.com" && uri.port == 443
      raise Error, "Repeated App Store Connect pagination URL" if visited[uri.to_s]
      visited[uri.to_s] = true
      document = get(uri)
      raise Error, "Malformed App Store Connect document" unless document.is_a?(Hash)
      included = document.fetch("included", []); raise Error, "Malformed App Store Connect included" unless included.is_a?(Array)
      data = document.fetch("data")
      raise Error, "Malformed App Store Connect data" unless data.is_a?(Array)
      total = document.dig("meta", "paging", "total")
      raise Error, "Malformed App Store Connect paging total" unless total.is_a?(Integer) && total >= 0
      expected_total ||= total
      raise Error, "Inconsistent App Store Connect paging total" unless total == expected_total
      items.concat(data.map { |item| item.merge("included" => included) })
      raise Error, "App Store Connect pagination exceeds total" if items.length > expected_total
      links = document.fetch("links", {})
      raise Error, "Malformed App Store Connect links" unless links.is_a?(Hash)
      next_url = links["next"]
      if next_url.nil?
        raise Error, "Incomplete App Store Connect pagination" unless items.length == expected_total
        break
      end
      raise Error, "Malformed App Store Connect next link" unless next_url.is_a?(String) && !next_url.empty?
      raise Error, "App Store Connect pagination continues after total" if items.length >= expected_total
      uri = URI(next_url)
    end
    items
  rescue JSON::ParserError, KeyError, TypeError, URI::InvalidURIError => e
    raise Error, "Malformed App Store Connect response: #{e.message}"
  end
  private
  def get(uri)
    4.times do |attempt|
      status, body = @request.call(uri, @token)
      return JSON.parse(body) if status.between?(200, 299)
      next @sleeper.call(2**attempt) if (status == 429 || status >= 500) && attempt < 3
      raise Error, "App Store Connect HTTP #{status}"
    end
  end
  def http_get(uri, token)
    request = Net::HTTP::Get.new(uri)
    request["Authorization"] = "Bearer #{token}"
    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |http| http.request(request) }
    [response.code.to_i, response.body]
  end
end
module AppStoreApp
  module_function
  def id(api, bundle_id)
    apps = api.pages("/v1/apps", { "filter[bundleId]" => bundle_id, "limit" => "200" })
    raise AppStoreApi::Error, "Expected exactly one App Store app" unless apps.length == 1
    app = apps.first
    valid = app["type"] == "apps" && app["id"].is_a?(String) && !app["id"].empty? && app.dig("attributes", "bundleId") == bundle_id
    raise AppStoreApi::Error, "Malformed App Store app" unless valid
    app["id"]
  end
end
module AppStoreValues
  BUILD_PROCESSING_STATES = %w[PROCESSING VALID FAILED INVALID].freeze
  APP_STORE_STATES = %w[
    DEVELOPER_REMOVED_FROM_SALE DEVELOPER_REJECTED IN_REVIEW INVALID_BINARY
    METADATA_REJECTED PENDING_APPLE_RELEASE PENDING_CONTRACT
    PENDING_DEVELOPER_RELEASE PREORDER_READY_FOR_SALE PREPARE_FOR_SUBMISSION
    PROCESSING_FOR_APP_STORE READY_FOR_REVIEW READY_FOR_SALE REJECTED
    REMOVED_FROM_SALE REPLACED_WITH_NEW_VERSION WAITING_FOR_EXPORT_COMPLIANCE
    WAITING_FOR_REVIEW
  ].freeze
  APP_VERSION_STATES = %w[
    ACCEPTED DEVELOPER_REJECTED IN_REVIEW INVALID PREPARE_FOR_SUBMISSION
    PROCESSING_FOR_DISTRIBUTION READY_FOR_DISTRIBUTION READY_FOR_REVIEW REJECTED
    REPLACED_WITH_NEW_VERSION WAITING_FOR_REVIEW
  ].freeze
end
class AppStoreBuildLookup
  def initialize(api) = (@api = api)
  def call(bundle_id, marketing_version, build_number)
    app_id = AppStoreApp.id(@api, bundle_id)
    builds = @api.pages("/v1/builds", { "filter[app]" => app_id, "filter[version]" => build_number,
      "include" => "preReleaseVersion", "limit" => "200" })
    return { "status" => "invalid" } unless builds.map { |build| [build["type"], build["id"]] }.uniq.length == builds.length
    details = builds.map do |build|
      attributes = build["attributes"]
      relation_id = build.dig("relationships", "preReleaseVersion", "data", "id")
      included = build["included"]
      versions = included.is_a?(Array) ? included.select { |item| item.is_a?(Hash) && item["type"] == "preReleaseVersions" && item["id"] == relation_id } : []
      version = versions.one? ? versions.first : nil
      complete = build["type"] == "builds" && build["id"].is_a?(String) && !build["id"].empty? && attributes.is_a?(Hash) && attributes["version"] == build_number && AppStoreValues::BUILD_PROCESSING_STATES.include?(attributes["processingState"]) && [true, false].include?(attributes["expired"]) && build.dig("relationships", "preReleaseVersion", "data", "type") == "preReleaseVersions" && relation_id.is_a?(String) && !relation_id.empty? && included.is_a?(Array) && included.all? { |item| item.is_a?(Hash) && item["type"] == "preReleaseVersions" && item["id"].is_a?(String) && !item["id"].empty? } && included.map { |item| [item["type"], item["id"]] }.uniq.length == included.length && version&.dig("attributes", "version").is_a?(String) && !version.dig("attributes", "version").empty?
      complete ? [build, version.dig("attributes", "version")] : nil
    end
    return { "status" => "invalid" } if details.any?(&:nil?)
    matches = details.select { |_build, version| version == marketing_version }.map(&:first)
    return { "status" => "not_found" } if matches.empty?
    return { "status" => "invalid" } unless matches.one?
    build = matches.first
    attributes = build.fetch("attributes")
    return { "status" => "invalid" } if attributes["expired"]
    status = { "PROCESSING" => "processing", "VALID" => "valid" }.fetch(attributes["processingState"], "invalid")
    { "status" => status, "build_id" => build.fetch("id") }
  end
end
class AppStoreBuildStatus
  def initialize(api) = (@lookup = AppStoreBuildLookup.new(api))
  def call(bundle_id, marketing_version, build_number)
    @lookup.call(bundle_id, marketing_version, build_number).fetch("status")
  end
end
class AppStoreBuildId
  def initialize(api) = (@lookup = AppStoreBuildLookup.new(api))
  def call(bundle_id, marketing_version, build_number)
    result = @lookup.call(bundle_id, marketing_version, build_number)
    raise AppStoreApi::Error, "Expected one exact valid App Store build" unless result["status"] == "valid"
    result.fetch("build_id")
  end
end
class AppStoreMarketingVersionStatus
  VERSION = /\A(?:0|[1-9][0-9]{0,17})(?:\.(?:0|[1-9][0-9]{0,17})){0,2}\z/
  def initialize(api) = (@api = api)
  def call(bundle_id, marketing_version)
    target = numeric_version(marketing_version)
    return "invalid" unless target
    app_id = AppStoreApp.id(@api, bundle_id)
    versions = @api.pages("/v1/apps/#{app_id}/appStoreVersions", {
      "filter[platform]" => "IOS", "limit" => "200"
    })
    return "invalid" unless versions.map { |version| [version["type"], version["id"]] }.uniq.length == versions.length
    details = versions.map do |version|
      attributes = version["attributes"]
      value = attributes.is_a?(Hash) ? attributes["versionString"] : nil
      numeric = numeric_version(value)
      complete = version["type"] == "appStoreVersions" && version["id"].is_a?(String) && !version["id"].empty? &&
        attributes.is_a?(Hash) && attributes["platform"] == "IOS" && numeric &&
        AppStoreValues::APP_STORE_STATES.include?(attributes["appStoreState"]) &&
        AppStoreValues::APP_VERSION_STATES.include?(attributes["appVersionState"])
      complete ? [version, value, numeric] : nil
    end
    return "invalid" if details.any?(&:nil?)
    return "invalid" unless details.map { |_version, value, _numeric| value }.uniq.length == details.length
    return "invalid" unless details.map { |_version, _value, numeric| numeric }.uniq.length == details.length

    matches = details.select { |_version, value, _numeric| value == marketing_version }
    return "invalid" unless matches.length <= 1
    distributed = details.select do |version, _value, _numeric|
      attributes = version.fetch("attributes")
      attributes["appStoreState"] == "READY_FOR_SALE" || attributes["appVersionState"] == "READY_FOR_DISTRIBUTION"
    end
    latest_distributed = distributed.map(&:last).max
    return "closed" if latest_distributed && (target <=> latest_distributed) <= 0
    return "open" if matches.empty?

    attributes = matches.first.first.fetch("attributes")
    return "open" if %w[PREPARE_FOR_SUBMISSION DEVELOPER_REJECTED].include?(attributes["appStoreState"]) && attributes["appVersionState"] == attributes["appStoreState"]
    "invalid"
  end

  private

  def numeric_version(value)
    return nil unless value.is_a?(String) && value.match?(VERSION)
    value.split(".").map { |part| Integer(part, 10) }.fill(0, value.split(".").length...3)
  end
end
class AppStoreNextBuildNumber
  def initialize(api) = (@api = api)
  def call(bundle_id, marketing_version)
    app_id = AppStoreApp.id(@api, bundle_id)
    builds = @api.pages("/v1/builds", {
      "filter[app]" => app_id, "include" => "preReleaseVersion", "limit" => "200"
    })
    return "invalid" unless builds.map { |build| [build["type"], build["id"]] }.uniq.length == builds.length
    numbers = builds.map do |build|
      attributes = build["attributes"]
      relation_id = build.dig("relationships", "preReleaseVersion", "data", "id")
      included = build["included"]
      versions = included.is_a?(Array) ? included.select { |item| item.is_a?(Hash) && item["type"] == "preReleaseVersions" && item["id"] == relation_id } : []
      version = versions.one? ? versions.first : nil
      build_number = attributes.is_a?(Hash) ? attributes["version"] : nil
      complete = build["type"] == "builds" && build["id"].is_a?(String) && !build["id"].empty? &&
        build_number.is_a?(String) && build_number.match?(/\A(?:0|[1-9][0-9]*)\z/) &&
        AppStoreValues::BUILD_PROCESSING_STATES.include?(attributes["processingState"]) &&
        [true, false].include?(attributes["expired"]) &&
        build.dig("relationships", "preReleaseVersion", "data", "type") == "preReleaseVersions" &&
        relation_id.is_a?(String) && !relation_id.empty? && included.is_a?(Array) &&
        included.all? { |item| item.is_a?(Hash) && item["type"] == "preReleaseVersions" && item["id"].is_a?(String) && !item["id"].empty? } &&
        included.map { |item| [item["type"], item["id"]] }.uniq.length == included.length &&
        version&.dig("attributes", "version").is_a?(String) && !version.dig("attributes", "version").empty?
      next :invalid unless complete
      version.dig("attributes", "version") == marketing_version ? Integer(build_number, 10) : nil
    end
    return "invalid" if numbers.include?(:invalid)
    selected_numbers = numbers.compact
    return "invalid" unless selected_numbers.uniq.length == selected_numbers.length
    ((selected_numbers.max || 0) + 1).to_s
  end
end
module AppStoreToken
  module_function
  def create(key_id, issuer_id, key_path, now = Time.now.to_i)
    encode = ->(value) { Base64.urlsafe_encode64(value, padding: false) }
    header = encode.call(JSON.generate(alg: "ES256", kid: key_id, typ: "JWT"))
    payload = encode.call(JSON.generate(iss: issuer_id, iat: now, exp: now + 1_200, aud: "appstoreconnect-v1"))
    signing_input = "#{header}.#{payload}"
    sequence = OpenSSL::ASN1.decode(OpenSSL::PKey.read(File.binread(key_path)).sign("SHA256", signing_input))
    signature = sequence.value.map { |integer| [integer.value.to_i.to_s(16).rjust(64, "0")].pack("H*") }.join
    "#{signing_input}.#{encode.call(signature)}"
  end
end
if $PROGRAM_NAME == __FILE__
  begin
    token = AppStoreToken.create(ENV.fetch("ASC_KEY_ID"), ENV.fetch("ASC_ISSUER_ID"), ENV.fetch("ASC_KEY_PATH"))
    api = AppStoreApi.new(token: token)
    if ARGV.first == "--build-id"
      abort "usage: app-store-build-status.rb --build-id BUNDLE_ID MARKETING_VERSION BUILD_NUMBER" unless ARGV.length == 4
      puts AppStoreBuildId.new(api).call(ARGV[1], ARGV[2], ARGV[3])
    elsif ARGV.first == "--marketing-version-status"
      abort "usage: app-store-build-status.rb --marketing-version-status BUNDLE_ID MARKETING_VERSION" unless ARGV.length == 3
      puts AppStoreMarketingVersionStatus.new(api).call(ARGV[1], ARGV[2])
    elsif ARGV.first == "--next-build-number"
      abort "usage: app-store-build-status.rb --next-build-number BUNDLE_ID MARKETING_VERSION" unless ARGV.length == 3
      puts AppStoreNextBuildNumber.new(api).call(ARGV[1], ARGV[2])
    else
      abort "usage: app-store-build-status.rb BUNDLE_ID MARKETING_VERSION BUILD_NUMBER" unless ARGV.length == 3
      puts AppStoreBuildStatus.new(api).call(*ARGV)
    end
  rescue StandardError => e
    warn "App Store build status failed: #{e.message}"
    exit 1
  end
end
