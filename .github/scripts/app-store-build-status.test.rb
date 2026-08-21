# frozen_string_literal: true
require "json"
require "minitest/autorun"
require "tempfile"
require_relative "app-store-build-status"
class FakeApi
  attr_reader :calls
  def initialize(apps: [{ "type" => "apps", "id" => "app", "attributes" => { "bundleId" => "app.pulpe.ios" } }], builds: [], versions: [])
    @apps, @builds, @versions, @calls = apps, builds, versions, []
  end
  def pages(path, query)
    @calls << [path, query]
    return @apps if path == "/v1/apps"
    return @versions if path.end_with?("/appStoreVersions")
    @builds
  end
end
class AppStoreBuildStatusTest < Minitest::Test
  def build(state, marketing: "1.4.2", number: "1", expired: false)
    {
      "type" => "builds", "id" => "build", "attributes" => { "version" => number, "processingState" => state, "expired" => expired },
      "relationships" => { "preReleaseVersion" => { "data" => { "type" => "preReleaseVersions", "id" => marketing } } },
      "included" => [{ "type" => "preReleaseVersions", "id" => marketing, "attributes" => { "version" => marketing } }]
    }
  end
  def status(builds) = AppStoreBuildStatus.new(FakeApi.new(builds: builds)).call("app.pulpe.ios", "1.4.2", "1")
  def test_exact_states
    { "PROCESSING" => "processing", "VALID" => "valid", "FAILED" => "invalid" }.each { |state, expected| assert_equal expected, status([build(state)]) }
    assert_equal "not_found", status([])
    assert_equal "invalid", status([build("VALID", expired: true)])
  end
  def test_ignores_other_versions_and_fails_closed_on_duplicates
    assert_equal "not_found", status([build("VALID", marketing: "1.4.3")])
    assert_equal "invalid", status([build("VALID"), build("PROCESSING")])
  end
  def test_partial_build_resources_fail_closed
    missing_relation = build("VALID").tap { |item| item.delete("relationships") }; missing_expired = build("VALID").tap { |item| item.fetch("attributes").delete("expired") }
    partials = [missing_relation, missing_expired, build("VALID").tap { |item| item.delete("type") }, build("VALID").tap { |item| item.delete("id") }, build("VALID").tap { |item| item.dig("relationships", "preReleaseVersion", "data").delete("type") }, build("VALID").tap { |item| item.dig("relationships", "preReleaseVersion", "data")["id"] = ""; item["included"][0]["id"] = "" }, build("VALID").tap { |item| item.dig("included", 0, "attributes")["version"] = "" }, build("VALID").tap { |item| item["included"] << item["included"][0].dup }]
    partials.each { |item| assert_equal "invalid", status([item]) }
    assert_equal "invalid", status([build("VALID"), missing_relation]); assert_equal "invalid", status([build("VALID").merge("id" => "same"), build("VALID", marketing: "1.4.3").merge("id" => "same")])
  end
  def test_partial_app_resources_fail_closed
    app = -> { { "type" => "apps", "id" => "app", "attributes" => { "bundleId" => "app.pulpe.ios" } } }; partials = [app.call.tap { |item| item.delete("type") }, app.call.tap { |item| item.delete("id") }, app.call.tap { |item| item["id"] = nil }, app.call.tap { |item| item.delete("attributes") }, app.call.tap { |item| item["attributes"]["bundleId"] = "other" }]
    partials.each { |item| assert_raises(AppStoreApi::Error) { AppStoreBuildStatus.new(FakeApi.new(apps: [item])).call("app.pulpe.ios", "1.4.2", "1") } }
  end
  def test_pagination_and_bounded_retry
    responses = [
      [429, "{}"], [200, JSON.generate(data: [{ "id" => "one" }], links: { next: "https://api.appstoreconnect.apple.com/page-2" })],
      [500, "{}"], [200, JSON.generate(data: [{ "id" => "two" }], links: {})]
    ]
    api = AppStoreApi.new(token: "token", request: ->(*) { responses.shift }, sleeper: ->(*) {})
    assert_equal %w[one two], api.pages("/v1/apps", {}).map { |item| item.fetch("id") }
    assert_empty responses
    hosts = []; request = ->(uri, *) { hosts << uri.host; hosts.one? ? [200, JSON.generate(data: [], links: { next: "https://api.appstoreconnect.apple.com:444/steal" })] : [401, "{}"] }
    assert_raises(AppStoreApi::Error) { AppStoreApi.new(token: "secret", request: request).pages("/v1/builds", {}) }
    assert_equal ["api.appstoreconnect.apple.com"], hosts
  end
  def test_api_errors_and_malformed_json_fail_closed
    [[401, "{}"], [200, "not json"], [200, JSON.generate(data: nil)], [200, JSON.generate(data: {})], [200, JSON.generate(data: [], included: {})]].each do |response|
      assert_raises(AppStoreApi::Error) { AppStoreApi.new(token: "token", request: ->(*) { response }, sleeper: ->(*) {}).pages("/v1/apps", {}) }
    end
  end
  def test_jwt_has_app_store_audience_and_raw_es256_signature
    Tempfile.create do |file|
      key = OpenSSL::PKey::EC.generate("prime256v1")
      file.write(key.to_pem); file.flush
      header, payload, encoded_signature = AppStoreToken.create("ABCDEFGHIJ", "issuer", file.path, 1_000).split(".")
      signature = Base64.urlsafe_decode64(encoded_signature)
      r, s = signature.unpack("a32a32").map { |part| part.unpack1("H*").to_i(16) }
      der = OpenSSL::ASN1::Sequence([OpenSSL::ASN1::Integer(r), OpenSSL::ASN1::Integer(s)]).to_der
      assert key.verify("SHA256", der, "#{header}.#{payload}")
      assert_equal "ES256", JSON.parse(Base64.urlsafe_decode64(header)).fetch("alg"); assert_equal "appstoreconnect-v1", JSON.parse(Base64.urlsafe_decode64(payload)).fetch("aud")
      assert_equal 64, signature.bytesize
    end
  end
end
class AppStoreMarketingVersionStatusTest < Minitest::Test
  def version(store_state:, version_state: nil)
    attributes = { "platform" => "IOS", "versionString" => "1.4.2", "appStoreState" => store_state }
    attributes["appVersionState"] = version_state if version_state
    { "type" => "appStoreVersions", "id" => "version", "attributes" => attributes }
  end
  def status(versions) = AppStoreMarketingVersionStatus.new(FakeApi.new(versions: versions)).call("app.pulpe.ios", "1.4.2")
  def test_open_when_version_is_absent_or_editable
    assert_equal "open", status([])
    assert_equal "open", status([version(store_state: "PREPARE_FOR_SUBMISSION", version_state: "PREPARE_FOR_SUBMISSION")])
  end
  def test_uses_the_official_app_versions_relationship_and_filters
    api = FakeApi.new(versions: [])
    assert_equal "open", AppStoreMarketingVersionStatus.new(api).call("app.pulpe.ios", "1.4.2")
    assert_equal [
      "/v1/apps/app/appStoreVersions",
      { "filter[platform]" => "IOS", "filter[versionString]" => "1.4.2", "limit" => "200" }
    ], api.calls.last
  end
  def test_closed_when_version_is_already_distributed
    assert_equal "closed", status([version(store_state: "READY_FOR_SALE", version_state: "READY_FOR_DISTRIBUTION")])
    assert_equal "closed", status([version(store_state: "READY_FOR_SALE", version_state: "PREPARE_FOR_SUBMISSION")])
    assert_equal "closed", status([version(store_state: "PREPARE_FOR_SUBMISSION", version_state: "READY_FOR_DISTRIBUTION")])
  end
  def test_malformed_duplicate_or_unknown_versions_fail_closed
    assert_equal "invalid", status([version(store_state: "READY_FOR_SALE"), version(store_state: "READY_FOR_SALE").merge("id" => "other")])
    assert_equal "invalid", status([version(store_state: "READY_FOR_SALE").tap { |item| item.delete("id") }])
    assert_equal "invalid", status([version(store_state: "UNKNOWN", version_state: "UNKNOWN")])
    assert_equal "invalid", status([version(store_state: "PREPARE_FOR_SUBMISSION")])
  end
end

class AppStoreNextBuildNumberTest < Minitest::Test
  def build(number, marketing:, id: "build-#{marketing}-#{number}", expired: false)
    {
      "type" => "builds",
      "id" => id,
      "attributes" => {
        "version" => number,
        "processingState" => "VALID",
        "expired" => expired
      },
      "relationships" => {
        "preReleaseVersion" => {
          "data" => { "type" => "preReleaseVersions", "id" => marketing }
        }
      },
      "included" => [{
        "type" => "preReleaseVersions",
        "id" => marketing,
        "attributes" => { "version" => marketing }
      }]
    }
  end

  def next_number(builds)
    AppStoreNextBuildNumber.new(FakeApi.new(builds: builds)).call("app.pulpe.ios", "1.4.2")
  end

  def test_new_marketing_version_starts_at_one_despite_higher_older_builds
    assert_equal "1", next_number([build("15", marketing: "1.0.1")])
    assert_equal "1", next_number([])
  end

  def test_increments_only_the_selected_marketing_version
    builds = [
      build("15", marketing: "1.0.1"),
      build("1", marketing: "1.4.2"),
      build("2", marketing: "1.4.2", expired: true)
    ]
    assert_equal "3", next_number(builds)
  end

  def test_malformed_or_ambiguous_builds_fail_closed
    malformed = build("1", marketing: "1.4.2").tap { |item| item.delete("relationships") }
    assert_equal "invalid", next_number([malformed])
    assert_equal "invalid", next_number([build("abc", marketing: "1.4.2")])
    duplicate_id = build("1", marketing: "1.4.2", id: "same")
    assert_equal "invalid", next_number([duplicate_id, build("2", marketing: "1.4.2", id: "same")])
    assert_equal "invalid", next_number([
      build("1", marketing: "1.4.2", id: "first"),
      build("1", marketing: "1.4.2", id: "second")
    ])
  end
end
