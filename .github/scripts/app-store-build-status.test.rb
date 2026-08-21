# frozen_string_literal: true
require "json"
require "minitest/autorun"
require "tempfile"
require_relative "app-store-build-status"
class FakeApi
  def initialize(apps: [{ "type" => "apps", "id" => "app", "attributes" => { "bundleId" => "app.pulpe.ios" } }], builds: []) = (@apps, @builds = apps, builds)
  def pages(path, _query) = path == "/v1/apps" ? @apps : @builds
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
