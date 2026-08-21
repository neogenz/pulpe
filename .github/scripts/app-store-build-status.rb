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
    loop do
      raise Error, "Untrusted App Store Connect pagination URL" unless uri.scheme == "https" && uri.host == "api.appstoreconnect.apple.com" && uri.port == 443
      document = get(uri)
      included = document.fetch("included", []); raise Error, "Malformed App Store Connect included" unless included.is_a?(Array)
      data = document.fetch("data")
      raise Error, "Malformed App Store Connect data" unless data.is_a?(Array)
      items.concat(data.map { |item| item.merge("included" => included) })
      break unless (next_url = document.dig("links", "next"))
      uri = URI(next_url)
    end
    items
  rescue JSON::ParserError, KeyError, URI::InvalidURIError => e
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
class AppStoreBuildStatus
  def initialize(api) = (@api = api)
  def call(bundle_id, marketing_version, build_number)
    app_id = AppStoreApp.id(@api, bundle_id)
    builds = @api.pages("/v1/builds", { "filter[app]" => app_id, "filter[version]" => build_number,
      "include" => "preReleaseVersion", "limit" => "200" })
    return "invalid" unless builds.map { |build| [build["type"], build["id"]] }.uniq.length == builds.length; details = builds.map do |build|
      attributes = build["attributes"]
      relation_id = build.dig("relationships", "preReleaseVersion", "data", "id"); included = build["included"]; versions = included.is_a?(Array) ? included.select { |item| item.is_a?(Hash) && item["type"] == "preReleaseVersions" && item["id"] == relation_id } : []
      version = versions.one? ? versions.first : nil
      complete = build["type"] == "builds" && build["id"].is_a?(String) && !build["id"].empty? && attributes.is_a?(Hash) && attributes["version"] == build_number && attributes["processingState"].is_a?(String) && [true, false].include?(attributes["expired"]) && build.dig("relationships", "preReleaseVersion", "data", "type") == "preReleaseVersions" && relation_id.is_a?(String) && !relation_id.empty? && included.is_a?(Array) && included.all? { |item| item.is_a?(Hash) && item["type"].is_a?(String) && item["id"].is_a?(String) && !item["id"].empty? } && included.map { |item| [item["type"], item["id"]] }.uniq.length == included.length && version&.dig("attributes", "version").is_a?(String) && !version.dig("attributes", "version").empty?
      complete ? [build, version.dig("attributes", "version")] : nil
    end
    return "invalid" if details.any?(&:nil?)
    matches = details.select { |_build, version| version == marketing_version }.map(&:first)
    return "not_found" if matches.empty?
    return "invalid" unless matches.one?
    attributes = matches.first.fetch("attributes")
    return "invalid" if attributes["expired"]
    { "PROCESSING" => "processing", "VALID" => "valid" }.fetch(attributes["processingState"], "invalid")
  end
end
class AppStoreMarketingVersionStatus
  def initialize(api) = (@api = api)
  def call(bundle_id, marketing_version)
    app_id = AppStoreApp.id(@api, bundle_id)
    versions = @api.pages("/v1/apps/#{app_id}/appStoreVersions", {
      "filter[platform]" => "IOS", "filter[versionString]" => marketing_version,
      "limit" => "200"
    })
    return "open" if versions.empty?
    return "invalid" unless versions.one?
    version = versions.first
    attributes = version["attributes"]
    complete = version["type"] == "appStoreVersions" && version["id"].is_a?(String) && !version["id"].empty? &&
      attributes.is_a?(Hash) && attributes["platform"] == "IOS" && attributes["versionString"] == marketing_version &&
      attributes["appStoreState"].is_a?(String)
    return "invalid" unless complete
    return "closed" if attributes["appStoreState"] == "READY_FOR_SALE" || attributes["appVersionState"] == "READY_FOR_DISTRIBUTION"
    "open"
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
    if ARGV.first == "--marketing-version-status"
      abort "usage: app-store-build-status.rb --marketing-version-status BUNDLE_ID MARKETING_VERSION" unless ARGV.length == 3
      puts AppStoreMarketingVersionStatus.new(api).call(ARGV[1], ARGV[2])
    else
      abort "usage: app-store-build-status.rb BUNDLE_ID MARKETING_VERSION BUILD_NUMBER" unless ARGV.length == 3
      puts AppStoreBuildStatus.new(api).call(*ARGV)
    end
  rescue StandardError => e
    warn "App Store build status failed: #{e.message}"
    exit 1
  end
end
