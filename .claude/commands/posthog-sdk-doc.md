{
"id": "d288651e-e2da-5e95-ad47-6ca7656d3449",
"hogRef": "0.3",
"info": {
"version": "1.260.2",
"description": "Posthog-js allows you to automatically capture usage and send events to PostHog.",
"id": "posthog-js",
"slugPrefix": "posthog-js",
"specUrl": "https://github.com/PostHog/posthog-js",
"title": "PostHog JavaScript Web SDK"
},
"classes": [
{
"description": "This is the SDK reference for the PostHog JavaScript Web SDK. You can learn more about example usage in the [JavaScript Web SDK documentation](/docs/libraries/js). You can also follow [framework specific guides](/docs/frameworks) to integrate PostHog into your project.\nThis SDK is designed for browser environments. Use the PostHog [Node.js SDK](/docs/libraries/node) for server-side usage.",
"id": "PostHog",
"title": "PostHog",
"functions": [
{
"category": "Identification",
"description": "Creates an alias linking two distinct user identifiers. Learn more about [identifying users](/docs/product-analytics/identify)",
"details": "PostHog will use this to link two distinct*ids going forward (not retroactively). Call this when a user signs up to connect their anonymous session with their account.",
"id": "alias",
"showDocs": true,
"title": "alias",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// link anonymous user to account on signup\nposthog.alias('user_12345')\n\n\n",
"id": "link_anonymous_user_to_account_on_signup",
"name": "link anonymous user to account on signup"
},
{
"code": "\n\n// explicit alias with original ID\nposthog.alias('user_12345', 'anonymous_abc123')\n\n\n\n",
"id": "explicit_alias_with_original_id",
"name": "explicit alias with original ID"
}
],
"params": [
{
"description": "A unique identifier that you want to use for this user in the future.",
"isOptional": false,
"type": "string",
"name": "alias"
},
{
"description": "The current identifier being used for this user.",
"isOptional": true,
"type": "string",
"name": "original"
}
],
"returnType": {
"id": "CaptureResult | void | number",
"name": "CaptureResult | void | number"
}
},
{
"category": "Surveys",
"description": "Checks the feature flags associated with this Survey to see if the survey can be rendered. This method is deprecated because it's synchronous and won't return the correct result if surveys are not loaded. Use `canRenderSurveyAsync` instead.",
"details": null,
"id": "canRenderSurvey",
"showDocs": true,
"title": "canRenderSurvey",
"releaseTag": "deprecated",
"examples": [
{
"code": "// Generated example for canRenderSurvey\nposthog.canRenderSurvey();",
"id": "canrendersurvey",
"name": "Generated example for canRenderSurvey"
}
],
"params": [
{
"description": "The ID of the survey to check.",
"isOptional": false,
"type": "string",
"name": "surveyId"
}
],
"returnType": {
"id": "SurveyRenderReason | null",
"name": "SurveyRenderReason | null"
}
},
{
"category": "Surveys",
"description": "Checks the feature flags associated with this Survey to see if the survey can be rendered.",
"details": null,
"id": "canRenderSurveyAsync",
"showDocs": true,
"title": "canRenderSurveyAsync",
"releaseTag": "public",
"examples": [
{
"code": "\n\nposthog.canRenderSurveyAsync(surveyId).then((result) => {\n if (result.visible) {\n // Survey can be rendered\n console.log('Survey can be rendered')\n } else {\n // Survey cannot be rendered\n console.log('Survey cannot be rendered:', result.disabledReason)\n }\n})\n\n\n\n",
"id": "",
"name": ""
}
],
"params": [
{
"description": "The ID of the survey to check.",
"isOptional": false,
"type": "string",
"name": "surveyId"
},
{
"description": "If true, the survey will be reloaded from the server, Default: false",
"isOptional": true,
"type": "boolean",
"name": "forceReload"
}
],
"returnType": {
"id": "Promise<SurveyRenderReason>",
"name": "Promise<SurveyRenderReason>"
}
},
{
"category": "Capture",
"description": "Captures an event with optional properties and configuration.",
"details": "You can capture arbitrary object-like values as events. [Learn about capture best practices](/docs/product-analytics/capture-events)",
"id": "capture",
"showDocs": true,
"title": "capture",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// basic event capture\nposthog.capture('cta-button-clicked', {\n button_name: 'Get Started',\n page: 'homepage'\n})\n\n\n\n\n\n",
"id": "basic_event_capture",
"name": "basic event capture"
}
],
"params": [
{
"description": "The name of the event (e.g., 'Sign Up', 'Button Click', 'Purchase')",
"isOptional": false,
"type": "EventName",
"name": "event_name"
},
{
"description": "Properties to include with the event describing the user or event details",
"isOptional": true,
"type": "Properties | null",
"name": "properties"
},
{
"description": "Optional configuration for the capture request",
"isOptional": true,
"type": "CaptureOptions",
"name": "options"
}
],
"returnType": {
"id": "CaptureResult | undefined",
"name": "CaptureResult | undefined"
}
},
{
"category": "Error tracking",
"description": "Capture a caught exception manually",
"details": null,
"id": "captureException",
"showDocs": true,
"title": "captureException",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// Capture a caught exception\ntry {\n // something that might throw\n} catch (error) {\n posthog.captureException(error)\n}\n\n\n",
"id": "capture_a_caught_exception",
"name": "Capture a caught exception"
},
{
"code": "\n\n// With additional properties\nposthog.captureException(error, {\n customProperty: 'value',\n anotherProperty: ['I', 'can be a list'],\n ...\n})\n\n\n\n",
"id": "with_additional_properties",
"name": "With additional properties"
}
],
"params": [
{
"description": "The error to capture",
"isOptional": false,
"type": "unknown",
"name": "error"
},
{
"description": "Any additional properties to add to the error event",
"isOptional": true,
"type": "Properties",
"name": "additionalProperties"
}
],
"returnType": {
"id": "CaptureResult | undefined",
"name": "CaptureResult | undefined"
}
},
{
"category": "LLM analytics",
"description": "Capture written user feedback for a LLM trace. Numeric values are converted to strings.",
"details": null,
"id": "captureTraceFeedback",
"showDocs": true,
"title": "captureTraceFeedback",
"releaseTag": "public",
"examples": [
{
"code": "// Generated example for captureTraceFeedback\nposthog.captureTraceFeedback();",
"id": "capturetracefeedback",
"name": "Generated example for captureTraceFeedback"
}
],
"params": [
{
"description": "The trace ID to capture feedback for.",
"isOptional": false,
"type": "string | number",
"name": "traceId"
},
{
"description": "The feedback to capture.",
"isOptional": false,
"type": "string",
"name": "userFeedback"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "LLM analytics",
"description": "Capture a metric for a LLM trace. Numeric values are converted to strings.",
"details": null,
"id": "captureTraceMetric",
"showDocs": true,
"title": "captureTraceMetric",
"releaseTag": "public",
"examples": [
{
"code": "// Generated example for captureTraceMetric\nposthog.captureTraceMetric();",
"id": "capturetracemetric",
"name": "Generated example for captureTraceMetric"
}
],
"params": [
{
"description": "The trace ID to capture the metric for.",
"isOptional": false,
"type": "string | number",
"name": "traceId"
},
{
"description": "The name of the metric to capture.",
"isOptional": false,
"type": "string",
"name": "metricName"
},
{
"description": "The value of the metric to capture.",
"isOptional": false,
"type": "string | number | boolean",
"name": "metricValue"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Privacy",
"description": "Clear the user's opt in/out status of data capturing and cookies/localstorage for this PostHog instance",
"details": null,
"id": "clear_opt_in_out_capturing",
"showDocs": true,
"title": "clear_opt_in_out_capturing",
"releaseTag": "public",
"examples": [
{
"code": "// Generated example for clear_opt_in_out_capturing\nposthog.clear_opt_in_out_capturing();",
"id": "clear_opt_in_out_capturing",
"name": "Generated example for clear_opt_in_out_capturing"
}
],
"params": [],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Identification",
"description": "Creates a person profile for the current user, if they don't already have one and config.person_profiles is set to 'identified_only'. Produces a warning and does not create a profile if config.person_profiles is set to 'never'. Learn more about [person profiles](/docs/product-analytics/identify)",
"details": null,
"id": "createPersonProfile",
"showDocs": true,
"title": "createPersonProfile",
"releaseTag": "public",
"examples": [
{
"code": "\n\nposthog.createPersonProfile()\n\n\n\n",
"id": "",
"name": ""
}
],
"params": [],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Initialization",
"description": "Enables or disables debug mode for detailed logging.",
"details": "Debug mode logs all PostHog calls to the browser console for troubleshooting. Can also be enabled by adding `?__posthog_debug=true` to the URL.",
"id": "debug",
"showDocs": true,
"title": "debug",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// enable debug mode\nposthog.debug(true)\n\n\n",
"id": "enable_debug_mode",
"name": "enable debug mode"
},
{
"code": "\n\n// disable debug mode\nposthog.debug(false)\n\n\n\n",
"id": "disable_debug_mode",
"name": "disable debug mode"
}
],
"params": [
{
"description": "If true, will enable debug mode.",
"isOptional": true,
"type": "boolean",
"name": "debug"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Identification",
"description": "Returns the current distinct ID for the user.",
"details": "This is either the auto-generated ID or the ID set via `identify()`. The distinct ID is used to associate events with users in PostHog.",
"id": "get_distinct_id",
"showDocs": true,
"title": "get_distinct_id",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// get the current user ID\nconst userId = posthog.get_distinct_id()\nconsole.log('Current user:', userId)\n\n\n",
"id": "get_the_current_user_id",
"name": "get the current user ID"
},
{
"code": "\n\n// use in loaded callback\nposthog.init('token', {\n loaded: (posthog) => {\n const id = posthog.get_distinct_id()\n // use the ID\n }\n})\n\n\n\n",
"id": "use_in_loaded_callback",
"name": "use in loaded callback"
}
],
"params": [],
"returnType": {
"id": "string",
"name": "string"
}
},
{
"category": "Identification",
"description": "Returns the value of a super property. Returns undefined if the property doesn't exist.",
"details": "get_property() can only be called after the PostHog library has finished loading. init() has a loaded function available to handle this automatically.",
"id": "get_property",
"showDocs": true,
"title": "get_property",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// grab value for '$user_id' after the posthog library has loaded\nposthog.init('<YOUR PROJECT TOKEN>', {\n    loaded: function(posthog) {\n        user_id = posthog.get_property('$user_id');\n }\n});\n\n\n\n",
"id": "grab_value_for*'$user_id'_after_the_posthog_library_has_loaded",
              "name": "grab value for '$user*id' after the posthog library has loaded"
}
],
"params": [
{
"description": "The name of the super property you want to retrieve",
"isOptional": false,
"type": "string",
"name": "property_name"
}
],
"returnType": {
"id": "Property | undefined",
"name": "Property | undefined"
}
},
{
"category": "Session replay",
"description": "Returns the current session_id.",
"details": "This should only be used for informative purposes. Any actual internal use case for the session_id should be handled by the sessionManager.",
"id": "get_session_id",
"showDocs": true,
"title": "get_session_id",
"releaseTag": "public",
"examples": [
{
"code": "// Generated example for get_session_id\nposthog.get_session_id();",
"id": "get_session_id",
"name": "Generated example for get_session_id"
}
],
"params": [],
"returnType": {
"id": "string",
"name": "string"
}
},
{
"category": "Session replay",
"description": "Returns the Replay url for the current session.",
"details": null,
"id": "get_session_replay_url",
"showDocs": true,
"title": "get_session_replay_url",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// basic usage\nposthog.get_session_replay_url()\n\n@example\n\njs // timestamp posthog.get_session_replay_url({ withTimestamp: true })\n\n\n@example\n\njs // timestamp and lookback posthog.get_session_replay_url({ withTimestamp: true, timestampLookBack: 30 // look back 30 seconds }) ```\n\n\n\n",
"id": "basic_usage",
"name": "basic usage"
}
],
"params": [
{
"description": "Options for the url",
"isOptional": true,
"type": "{\n withTimestamp?: boolean;\n timestampLookBack?: number;\n }",
"name": "options"
}
],
"returnType": {
"id": "string",
"name": "string"
}
},
{
"category": "Surveys",
"description": "Get surveys that should be enabled for the current user. See [fetching surveys documentation](/docs/surveys/implementing-custom-surveys#fetching-surveys-manually) for more details.",
"details": null,
"id": "getActiveMatchingSurveys",
"showDocs": true,
"title": "getActiveMatchingSurveys",
"releaseTag": "public",
"examples": [
{
"code": "\n\nposthog.getActiveMatchingSurveys((surveys) => {\n // do something\n})\n\n\n\n",
"id": "",
"name": ""
}
],
"params": [
{
"description": "The callback function will be called when the surveys are loaded or updated.",
"isOptional": false,
"type": "SurveyCallback",
"name": "callback"
},
{
"description": "Whether to force a reload of the surveys.",
"isOptional": true,
"type": "boolean",
"name": "forceReload"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Feature flags",
"description": "Get the list of early access features. To check enrollment status, use `isFeatureEnabled`. [Learn more in the docs](/docs/feature-flags/early-access-feature-management#option-2-custom-implementation)",
"details": null,
"id": "getEarlyAccessFeatures",
"showDocs": true,
"title": "getEarlyAccessFeatures",
"releaseTag": "public",
"examples": [
{
"code": "\n\nconst posthog = usePostHog()\nconst activeFlags = useActiveFeatureFlags()\n\nconst [activeBetas, setActiveBetas] = useState([])\nconst [inactiveBetas, setInactiveBetas] = useState([])\nconst [comingSoonFeatures, setComingSoonFeatures] = useState([])\n\nuseEffect(() => {\n posthog.getEarlyAccessFeatures((features) => {\n // Filter features by stage\n const betaFeatures = features.filter(feature => feature.stage === 'beta')\n const conceptFeatures = features.filter(feature => feature.stage === 'concept')\n\n setComingSoonFeatures(conceptFeatures)\n\n if (!activeFlags || activeFlags.length === 0) {\n setInactiveBetas(betaFeatures)\n return\n }\n\n const activeBetas = betaFeatures.filter(\n beta => activeFlags.includes(beta.flagKey)\n );\n const inactiveBetas = betaFeatures.filter(\n beta => !activeFlags.includes(beta.flagKey)\n );\n setActiveBetas(activeBetas)\n setInactiveBetas(inactiveBetas)\n }, true, ['concept', 'beta'])\n}, [activeFlags])\n\n\n\n",
"id": "",
"name": ""
}
],
"params": [
{
"description": "The callback function will be called when the early access features are loaded.",
"isOptional": false,
"type": "EarlyAccessFeatureCallback",
"name": "callback"
},
{
"description": "Whether to force a reload of the early access features.",
"isOptional": true,
"type": "boolean",
"name": "force_reload"
},
{
"description": "The stages of the early access features to load.",
"isOptional": true,
"type": "EarlyAccessFeatureStage[]",
"name": "stages"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Feature flags",
"description": "Gets the value of a feature flag for the current user.",
"details": "Returns the feature flag value which can be a boolean, string, or undefined. Supports multivariate flags that can return custom string values.",
"id": "getFeatureFlag",
"showDocs": true,
"title": "getFeatureFlag",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// check boolean flag\nif (posthog.getFeatureFlag('new-feature')) {\n // show new feature\n}\n\n\n",
"id": "check_boolean_flag",
"name": "check boolean flag"
},
{
"code": "\n\n// check multivariate flag\nconst variant = posthog.getFeatureFlag('button-color')\nif (variant === 'red') {\n // show red button\n}\n\n\n\n",
"id": "check_multivariate_flag",
"name": "check multivariate flag"
}
],
"params": [
{
"description": "",
"isOptional": false,
"type": "string",
"name": "key"
},
{
"description": "(optional) If send_event: false, we won't send an $feature_flag_call event to PostHog.",
"isOptional": true,
"type": "{\n send_event?: boolean;\n }",
"name": "options"
}
],
"returnType": {
"id": "boolean | string | undefined",
"name": "boolean | string | undefined"
}
},
{
"category": "Feature flags",
"description": "Get feature flag payload value matching key for user (supports multivariate flags).",
"details": null,
"id": "getFeatureFlagPayload",
"showDocs": true,
"title": "getFeatureFlagPayload",
"releaseTag": "public",
"examples": [
{
"code": "\n\nif(posthog.getFeatureFlag('beta-feature') === 'some-value') {\n const someValue = posthog.getFeatureFlagPayload('beta-feature')\n // do something\n}\n\n\n\n",
"id": "",
"name": ""
}
],
"params": [
{
"description": "",
"isOptional": false,
"type": "string",
"name": "key"
}
],
"returnType": {
"id": "JsonType",
"name": "JsonType"
}
},
{
"category": "Identification",
"description": "Returns the current groups.",
"details": null,
"id": "getGroups",
"showDocs": true,
"title": "getGroups",
"releaseTag": "public",
"examples": [
{
"code": "// Generated example for getGroups\nposthog.getGroups();",
"id": "getgroups",
"name": "Generated example for getGroups"
}
],
"params": [],
"returnType": {
"id": "Record<string, any>",
"name": "Record<string, any>"
}
},
{
"category": "Initialization",
"description": "Returns the current page view ID.",
"details": null,
"id": "getPageViewId",
"showDocs": true,
"title": "getPageViewId",
"releaseTag": "public",
"examples": [
{
"code": "// Generated example for getPageViewId\nposthog.getPageViewId();",
"id": "getpageviewid",
"name": "Generated example for getPageViewId"
}
],
"params": [],
"returnType": {
"id": "string | undefined",
"name": "string | undefined"
}
},
{
"category": "Identification",
"description": "Returns the value of the session super property named property_name. If no such property is set, getSessionProperty() will return the undefined value.",
"details": "This is based on browser-level `sessionStorage`, NOT the PostHog session. getSessionProperty() can only be called after the PostHog library has finished loading. init() has a loaded function available to handle this automatically.",
"id": "getSessionProperty",
"showDocs": true,
"title": "getSessionProperty",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// grab value for 'user_id' after the posthog library has loaded\nposthog.init('YOUR PROJECT TOKEN', {\n loaded: function(posthog) {\n user_id = posthog.getSessionProperty('user_id');\n }\n});\n\n\n",
"id": "grab_value_for*'user*id'\_after_the_posthog_library_has_loaded",
"name": "grab value for 'user_id' after the posthog library has loaded"
}
],
"params": [
{
"description": "The name of the session super property you want to retrieve",
"isOptional": false,
"type": "string",
"name": "property_name"
}
],
"returnType": {
"id": "Property | undefined",
"name": "Property | undefined"
}
},
{
"category": "Surveys",
"description": "Get list of all surveys.",
"details": null,
"id": "getSurveys",
"showDocs": true,
"title": "getSurveys",
"releaseTag": "public",
"examples": [
{
"code": "\n\nfunction callback(surveys, context) {\n // do something\n}\n\nposthog.getSurveys(callback, false)\n\n\n\n",
"id": "",
"name": ""
}
],
"params": [
{
"description": "Function that receives the array of surveys",
"isOptional": false,
"type": "SurveyCallback",
"name": "callback"
},
{
"description": "Optional boolean to force an API call for updated surveys",
"isOptional": true,
"type": "boolean",
"name": "forceReload"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Identification",
"description": "Associates the user with a group for group-based analytics. Learn more about [groups](/docs/product-analytics/group-analytics)",
"details": "Groups allow you to analyze users collectively (e.g., by organization, team, or account). This sets the group association for all subsequent events and reloads feature flags.",
"id": "group",
"showDocs": true,
"title": "group",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// associate user with an organization\nposthog.group('organization', 'org_12345', {\n name: 'Acme Corp',\n plan: 'enterprise'\n})\n\n\n",
"id": "associate_user_with_an_organization",
"name": "associate user with an organization"
},
{
"code": "\n\n// associate with multiple group types\nposthog.group('organization', 'org_12345')\nposthog.group('team', 'team_67890')\n\n\n\n",
"id": "associate_with_multiple_group_types",
"name": "associate with multiple group types"
}
],
"params": [
{
"description": "Group type (example: 'organization')",
"isOptional": false,
"type": "string",
"name": "groupType"
},
{
"description": "Group key (example: 'org::5')",
"isOptional": false,
"type": "string",
"name": "groupKey"
},
{
"description": "Optional properties to set for group",
"isOptional": true,
"type": "Properties",
"name": "groupPropertiesToSet"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Privacy",
"description": "Checks if the user has opted into data capturing.",
"details": "Returns the current consent status for event tracking and data persistence.",
"id": "has_opted_in_capturing",
"showDocs": true,
"title": "has_opted_in_capturing",
"releaseTag": "public",
"examples": [
{
"code": "\n\nif (posthog.has_opted_in_capturing()) {\n // show analytics features\n}\n\n\n\n",
"id": "",
"name": ""
}
],
"params": [],
"returnType": {
"id": "boolean",
"name": "boolean"
}
},
{
"category": "Privacy",
"description": "Checks if the user has opted out of data capturing.",
"details": "Returns the current consent status for event tracking and data persistence.",
"id": "has_opted_out_capturing",
"showDocs": true,
"title": "has_opted_out_capturing",
"releaseTag": "public",
"examples": [
{
"code": "\n\nif (posthog.has_opted_out_capturing()) {\n // disable analytics features\n}\n\n\n\n",
"id": "",
"name": ""
}
],
"params": [],
"returnType": {
"id": "boolean",
"name": "boolean"
}
},
{
"category": "Identification",
"description": "Associates a user with a unique identifier instead of an auto-generated ID. Learn more about [identifying users](/docs/product-analytics/identify)",
"details": "By default, PostHog assigns each user a randomly generated `distinct_id`. Use this method to replace that ID with your own unique identifier (like a user ID from your database).",
"id": "identify",
"showDocs": true,
"title": "identify",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// basic identification\nposthog.identify('user_12345')\n\n\n",
"id": "basic_identification",
"name": "basic identification"
},
{
"code": "\n\n// identify with user properties\nposthog.identify('user_12345', {\n email: 'user@example.com',\n plan: 'premium'\n})\n\n\n",
"id": "identify_with_user_properties",
"name": "identify with user properties"
},
{
"code": "\n\n// identify with set and set_once properties\nposthog.identify('user_12345',\n { last_login: new Date() }, // updates every time\n { signup_date: new Date() } // sets only once\n)\n\n\n\n",
"id": "identify_with_set_and_set_once_properties",
"name": "identify with set and set_once properties"
}
],
"params": [
{
"description": "A string that uniquely identifies a user. If not provided, the distinct_id currently in the persistent store (cookie or localStorage) will be used.",
"isOptional": true,
"type": "string",
"name": "new_distinct_id"
},
{
"description": "Optional: An associative array of properties to store about the user. Note: For feature flag evaluations, if the same key is present in the userPropertiesToSetOnce, it will be overwritten by the value in userPropertiesToSet.",
"isOptional": true,
"type": "Properties",
"name": "userPropertiesToSet"
},
{
"description": "Optional: An associative array of properties to store about the user. If property is previously set, this does not override that value.",
"isOptional": true,
"type": "Properties",
"name": "userPropertiesToSetOnce"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Initialization",
"description": "Initializes a new instance of the PostHog capturing object.",
"details": "All new instances are added to the main posthog object as sub properties (such as `posthog.library_name`) and also returned by this function. [Learn more about configuration options](https://github.com/posthog/posthog-js/blob/6e0e873/src/posthog-core.js#L57-L91)",
"id": "init",
"showDocs": true,
"title": "init",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// basic initialization\nposthog.init('<ph_project_api_key>', {\n api_host: '<ph_client_api_host>'\n})\n\n\n",
"id": "basic_initialization",
"name": "basic initialization"
},
{
"code": "\n\n// multiple instances\nposthog.init('<ph_project_api_key>', {}, 'project1')\nposthog.init('<ph_project_api_key>', {}, 'project2')\n\n\n\n",
"id": "multiple_instances",
"name": "multiple instances"
}
],
"params": [
{
"description": "Your PostHog API token",
"isOptional": false,
"type": "string",
"name": "token"
},
{
"description": "A dictionary of config options to override",
"isOptional": true,
"type": "OnlyValidKeys<Partial<PostHogConfig>, Partial<PostHogConfig>>",
"name": "config"
},
{
"description": "The name for the new posthog instance that you want created",
"isOptional": true,
"type": "string",
"name": "name"
}
],
"returnType": {
"id": "PostHog",
"name": "PostHog"
}
},
{
"category": "Privacy",
"description": "Checks whether the PostHog library is currently capturing events.\nUsually this means that the user has not opted out of capturing, but the exact behaviour can be controlled by some config options.\nAdditionally, if the cookieless_mode is set to 'on_reject', we will capture events in cookieless mode if the user has explicitly opted out.",
"details": null,
"id": "is_capturing",
"showDocs": true,
"title": "is_capturing",
"releaseTag": "public",
"examples": [
{
"code": "// Generated example for is_capturing\nposthog.is_capturing();",
"id": "is_capturing",
"name": "Generated example for is_capturing"
}
],
"params": [],
"returnType": {
"id": "boolean",
"name": "boolean"
}
},
{
"category": "Feature flags",
"description": "Checks if a feature flag is enabled for the current user.",
"details": "Returns true if the flag is enabled, false if disabled, or undefined if not found. This is a convenience method that treats any truthy value as enabled.",
"id": "isFeatureEnabled",
"showDocs": true,
"title": "isFeatureEnabled",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// simple feature flag check\nif (posthog.isFeatureEnabled('new-checkout')) {\n showNewCheckout()\n}\n\n\n",
"id": "simple_feature_flag_check",
"name": "simple feature flag check"
},
{
"code": "\n\n// disable event tracking\nif (posthog.isFeatureEnabled('feature', { send_event: false })) {\n // flag checked without sending $feature_flag_call event\n}\n\n\n\n",
"id": "disable_event_tracking",
"name": "disable event tracking"
}
],
"params": [
{
"description": "",
"isOptional": false,
"type": "string",
"name": "key"
},
{
"description": "(optional) If send_event: false, we won't send an $feature_flag_call event to PostHog.",
"isOptional": true,
"type": "{\n send_event: boolean;\n }",
"name": "options"
}
],
"returnType": {
"id": "boolean | undefined",
"name": "boolean | undefined"
}
},
{
"category": "Toolbar",
"description": "returns a boolean indicating whether the [toolbar](/docs/toolbar) loaded",
"details": null,
"id": "loadToolbar",
"showDocs": true,
"title": "loadToolbar",
"releaseTag": "public",
"examples": [
{
"code": "// Generated example for loadToolbar\nposthog.loadToolbar();",
"id": "loadtoolbar",
"name": "Generated example for loadToolbar"
}
],
"params": [
{
"description": "",
"isOptional": false,
"type": "ToolbarParams",
"name": "params"
}
],
"returnType": {
"id": "boolean",
"name": "boolean"
}
},
{
"category": "Capture",
"description": "Exposes a set of events that PostHog will emit. e.g. `eventCaptured` is emitted immediately before trying to send an event\nUnlike `onFeatureFlags` and `onSessionId` these are not called when the listener is registered, the first callback will be the next event \_after* registering a listener",
"details": null,
"id": "on",
"showDocs": true,
"title": "on",
"releaseTag": "public",
"examples": [
{
"code": "\n\nposthog.on('eventCaptured', (event) => {\n console.log(event)\n})\n\n\n\n",
"id": "",
"name": ""
}
],
"params": [
{
"description": "The event to listen for.",
"isOptional": false,
"type": "'eventCaptured'",
"name": "event"
},
{
"description": "The callback function to call when the event is emitted.",
"isOptional": false,
"type": "(...args: any[]) => void",
"name": "cb"
}
],
"returnType": {
"id": "() => void",
"name": "() => void"
}
},
{
"category": "Feature flags",
"description": "Register an event listener that runs when feature flags become available or when they change. If there are flags, the listener is called immediately in addition to being called on future changes. Note that this is not called only when we fetch feature flags from the server, but also when they change in the browser.",
"details": null,
"id": "onFeatureFlags",
"showDocs": true,
"title": "onFeatureFlags",
"releaseTag": "public",
"examples": [
{
"code": "\n\nposthog.onFeatureFlags(function(featureFlags, featureFlagsVariants, { errorsLoading }) {\n // do something\n})\n\n\n",
"id": "",
"name": ""
}
],
"params": [
{
"description": "The callback function will be called once the feature flags are ready or when they are updated. It'll return a list of feature flags enabled for the user, the variants, and also a context object indicating whether we succeeded to fetch the flags or not.",
"isOptional": false,
"type": "FeatureFlagsCallback",
"name": "callback"
}
],
"returnType": {
"id": "() => void",
"name": "() => void"
}
},
{
"category": "Identification",
"description": "Register an event listener that runs whenever the session id or window id change. If there is already a session id, the listener is called immediately in addition to being called on future changes.\nCan be used, for example, to sync the PostHog session id with a backend session.",
"details": null,
"id": "onSessionId",
"showDocs": true,
"title": "onSessionId",
"releaseTag": "public",
"examples": [
{
"code": "\n\nposthog.onSessionId(function(sessionId, windowId) { // do something })\n\n\n",
"id": "",
"name": ""
}
],
"params": [
{
"description": "The callback function will be called once a session id is present or when it or the window id are updated.",
"isOptional": false,
"type": "SessionIdChangedCallback",
"name": "callback"
}
],
"returnType": {
"id": "() => void",
"name": "() => void"
}
},
{
"category": "Surveys",
"description": "Register an event listener that runs when surveys are loaded.\nCallback parameters: - surveys: Survey[]: An array containing all survey objects fetched from PostHog using the getSurveys method - context: isLoaded: boolean, error?: string : An object indicating if the surveys were loaded successfully",
"details": null,
"id": "onSurveysLoaded",
"showDocs": true,
"title": "onSurveysLoaded",
"releaseTag": "public",
"examples": [
{
"code": "\n\nposthog.onSurveysLoaded((surveys, context) => { // do something })\n\n\n",
"id": "",
"name": ""
}
],
"params": [
{
"description": "The callback function will be called when surveys are loaded or updated.",
"isOptional": false,
"type": "SurveyCallback",
"name": "callback"
}
],
"returnType": {
"id": "() => void",
"name": "() => void"
}
},
{
"category": "Privacy",
"description": "Opts the user into data capturing and persistence.",
"details": "Enables event tracking and data persistence (cookies/localStorage) for this PostHog instance. By default, captures an `$opt_in` event unless disabled.",
"id": "opt*in_capturing",
"showDocs": true,
"title": "opt_in_capturing",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// simple opt-in\nposthog.opt_in_capturing()\n\n\n",
"id": "simple_opt-in",
"name": "simple opt-in"
},
{
"code": "\n\n// opt-in with custom event and properties\nposthog.opt_in_capturing({\n captureEventName: 'Privacy Accepted',\n captureProperties: { source: 'banner' }\n})\n\n\n",
"id": "opt-in_with_custom_event_and_properties",
"name": "opt-in with custom event and properties"
},
{
"code": "\n\n// opt-in without capturing event\nposthog.opt_in_capturing({\n captureEventName: false\n})\n\n\n\n",
"id": "opt-in_without_capturing_event",
"name": "opt-in without capturing event"
}
],
"params": [
{
"description": "",
"isOptional": true,
"type": "{\n captureEventName?: EventName | null | false; /** event name to be used for capturing the opt-in action */\n captureProperties?: Properties; /** set of properties to be captured along with the opt-in action */\n }",
"name": "options"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Privacy",
"description": "Opts the user out of data capturing and persistence.",
"details": "Disables event tracking and data persistence (cookies/localStorage) for this PostHog instance. If `opt_out_persistence_by_default` is true, SDK persistence will also be disabled.",
"id": "opt_out_capturing",
"showDocs": true,
"title": "opt_out_capturing",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// opt user out (e.g., on privacy settings page)\nposthog.opt_out_capturing()\n\n\n\n",
"id": "opt_user_out*(e.g.,\_on_privacy_settings_page)",
"name": "opt user out (e.g., on privacy settings page)"
}
],
"params": [],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "",
"description": "push() keeps the standard async-array-push behavior around after the lib is loaded. This is only useful for external integrations that do not wish to rely on our convenience methods (created in the snippet).",
"details": null,
"id": "push",
"showDocs": true,
"title": "push",
"releaseTag": "public",
"examples": [
{
"code": "\n\nposthog.push(['register', { a: 'b' }]);\n\n\n",
"id": "",
"name": ""
}
],
"params": [
{
"description": "A [function_name, args...] array to be executed",
"isOptional": false,
"type": "SnippetArrayItem",
"name": "item"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Capture",
"description": "Registers super properties for the current session only.",
"details": "Session super properties are automatically added to all events during the current browser session. Unlike regular super properties, these are cleared when the session ends and are stored in sessionStorage.",
"id": "register_for_session",
"showDocs": true,
"title": "register_for_session",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// register session-specific properties\nposthog.register_for_session({\n current_page_type: 'checkout',\n ab_test_variant: 'control'\n})\n\n\n",
"id": "register_session-specific_properties",
"name": "register session-specific properties"
},
{
"code": "\n\n// register properties for user flow tracking\nposthog.register_for_session({\n selected_plan: 'pro',\n completed_steps: 3,\n flow_id: 'signup_flow_v2'\n})\n\n\n\n",
"id": "register_properties_for_user_flow_tracking",
"name": "register properties for user flow tracking"
}
],
"params": [
{
"description": "An associative array of properties to store about the user",
"isOptional": false,
"type": "Properties",
"name": "properties"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Capture",
"description": "Registers super properties only if they haven't been set before.",
"details": "Unlike `register()`, this method will not overwrite existing super properties. Use this for properties that should only be set once, like signup date or initial referrer.",
"id": "register_once",
"showDocs": true,
"title": "register_once",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// register once-only properties\nposthog.register_once({\n first_login_date: new Date().toISOString(),\n initial_referrer: document.referrer\n})\n\n\n",
"id": "register_once-only_properties",
"name": "register once-only properties"
},
{
"code": "\n\n// override existing value if it matches default\nposthog.register_once(\n { user_type: 'premium' },\n 'unknown' // overwrite if current value is 'unknown'\n)\n\n\n\n",
"id": "override_existing_value_if_it_matches_default",
"name": "override existing value if it matches default"
}
],
"params": [
{
"description": "An associative array of properties to store about the user",
"isOptional": false,
"type": "Properties",
"name": "properties"
},
{
"description": "Value to override if already set in super properties (ex: 'False') Default: 'None'",
"isOptional": true,
"type": "Property",
"name": "default_value"
},
{
"description": "How many days since the users last visit to store the super properties",
"isOptional": true,
"type": "number",
"name": "days"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Capture",
"description": "Registers super properties that are included with all events.",
"details": "Super properties are stored in persistence and automatically added to every event you capture. These values will overwrite any existing super properties with the same keys.",
"id": "register",
"showDocs": true,
"title": "register",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// register a single property\nposthog.register({ plan: 'premium' })\n\n\n\n\n",
"id": "register_a_single_property",
"name": "register a single property"
},
{
"code": "\n\n// register multiple properties\nposthog.register({\n email: 'user@example.com',\n account_type: 'business',\n signup_date: '2023-01-15'\n})\n\n\n",
"id": "register_multiple_properties",
"name": "register multiple properties"
},
{
"code": "\n\n// register with custom expiration\nposthog.register({ campaign: 'summer_sale' }, 7) // expires in 7 days\n\n\n\n",
"id": "register_with_custom_expiration",
"name": "register with custom expiration"
}
],
"params": [
{
"description": "properties to store about the user",
"isOptional": false,
"type": "Properties",
"name": "properties"
},
{
"description": "How many days since the user's last visit to store the super properties",
"isOptional": true,
"type": "number",
"name": "days"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Feature flags",
"description": "Feature flag values are cached. If something has changed with your user and you'd like to refetch their flag values, call this method.",
"details": null,
"id": "reloadFeatureFlags",
"showDocs": true,
"title": "reloadFeatureFlags",
"releaseTag": "public",
"examples": [
{
"code": "\n\nposthog.reloadFeatureFlags()\n\n\n\n",
"id": "",
"name": ""
}
],
"params": [],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Surveys",
"description": "Although we recommend using popover surveys and display conditions, if you want to show surveys programmatically without setting up all the extra logic needed for API surveys, you can render surveys programmatically with the renderSurvey method.\nThis takes a survey ID and an HTML selector to render an unstyled survey.",
"details": null,
"id": "renderSurvey",
"showDocs": true,
"title": "renderSurvey",
"releaseTag": "public",
"examples": [
{
"code": "\n\nposthog.renderSurvey(coolSurveyID, '#survey-container')\n\n\n\n",
"id": "",
"name": ""
}
],
"params": [
{
"description": "The ID of the survey to render.",
"isOptional": false,
"type": "string",
"name": "surveyId"
},
{
"description": "The selector of the HTML element to render the survey on.",
"isOptional": false,
"type": "string",
"name": "selector"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Identification",
"description": "Resets all user data and starts a fresh session.\n⚠️ **Warning**: Only call this when a user logs out. Calling at the wrong time can cause split sessions.\nThis clears: - Session ID and super properties - User identification (sets new random distinct_id) - Cached data and consent settings",
"details": null,
"id": "reset",
"showDocs": true,
"title": "reset",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// reset on user logout\nfunction logout() {\n posthog.reset()\n // redirect to login page\n}\n\n\n",
"id": "reset_on_user_logout",
"name": "reset on user logout"
},
{
"code": "\n\n// reset and generate new device ID\nposthog.reset(true) // also resets device_id\n\n\n\n",
"id": "reset_and_generate_new_device_id",
"name": "reset and generate new device ID"
}
],
"params": [
{
"description": "",
"isOptional": true,
"type": "boolean",
"name": "reset_device_id"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Feature flags",
"description": "Resets the group properties for feature flags.",
"details": null,
"id": "resetGroupPropertiesForFlags",
"showDocs": true,
"title": "resetGroupPropertiesForFlags",
"releaseTag": "public",
"examples": [
{
"code": "\n\nposthog.resetGroupPropertiesForFlags()\n\n\n\n",
"id": "",
"name": ""
}
],
"params": [
{
"description": "",
"isOptional": true,
"type": "string",
"name": "group_type"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Identification",
"description": "Resets only the group properties of the user currently logged in. Learn more about [groups](/docs/product-analytics/group-analytics)",
"details": null,
"id": "resetGroups",
"showDocs": true,
"title": "resetGroups",
"releaseTag": "public",
"examples": [
{
"code": "\n\nposthog.resetGroups()\n\n\n\n",
"id": "",
"name": ""
}
],
"params": [],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Feature flags",
"description": "Resets the person properties for feature flags.",
"details": null,
"id": "resetPersonPropertiesForFlags",
"showDocs": true,
"title": "resetPersonPropertiesForFlags",
"releaseTag": "public",
"examples": [
{
"code": "\n\nposthog.resetPersonPropertiesForFlags()\n\n\n\n",
"id": "",
"name": ""
}
],
"params": [],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Session replay",
"description": "returns a boolean indicating whether session recording is currently running",
"details": null,
"id": "sessionRecordingStarted",
"showDocs": true,
"title": "sessionRecordingStarted",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// Stop session recording if it's running\nif (posthog.sessionRecordingStarted()) {\n posthog.stopSessionRecording()\n}\n\n\n\n",
"id": "stop_session_recording_if_it's_running",
"name": "Stop session recording if it's running"
}
],
"params": [],
"returnType": {
"id": "boolean",
"name": "boolean"
}
},
{
"category": "Initialization",
"description": "Updates the configuration of the PostHog instance.",
"details": null,
"id": "set_config",
"showDocs": true,
"title": "set_config",
"releaseTag": "public",
"examples": [
{
"code": "// Generated example for set_config\nposthog.set_config();",
"id": "set_config",
"name": "Generated example for set_config"
}
],
"params": [
{
"description": "A dictionary of new configuration values to update",
"isOptional": false,
"type": "Partial<PostHogConfig>",
"name": "config"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Feature flags",
"description": "Set override group properties for feature flags. This is used when dealing with new groups / where you don't want to wait for ingestion to update properties. Takes in an object, the key of which is the group type.",
"details": null,
"id": "setGroupPropertiesForFlags",
"showDocs": true,
"title": "setGroupPropertiesForFlags",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// Set properties with reload\nposthog.setGroupPropertiesForFlags({'organization': { name: 'CYZ', employees: '11' } })\n\n\n",
"id": "set_properties_with_reload",
"name": "Set properties with reload"
},
{
"code": "\n\n// Set properties without reload\nposthog.setGroupPropertiesForFlags({'organization': { name: 'CYZ', employees: '11' } }, false)\n\n\n\n",
"id": "set_properties_without_reload",
"name": "Set properties without reload"
}
],
"params": [
{
"description": "The properties to override, the key of which is the group type.",
"isOptional": false,
"type": "{\n [type: string]: Properties;\n }",
"name": "properties"
},
{
"description": "Whether to reload feature flags.",
"isOptional": true,
"type": "boolean",
"name": "reloadFeatureFlags"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Identification",
"description": "Sets properties on the person profile associated with the current `distinct_id`. Learn more about [identifying users](/docs/product-analytics/identify)",
"details": "Updates user properties that are stored with the person profile in PostHog. If `person_profiles` is set to `identified_only` and no profile exists, this will create one.",
"id": "setPersonProperties",
"showDocs": true,
"title": "setPersonProperties",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// set user properties\nposthog.setPersonProperties({\n email: 'user@example.com',\n plan: 'premium'\n})\n\n\n",
"id": "set_user_properties",
"name": "set user properties"
},
{
"code": "\n\n// set properties\nposthog.setPersonProperties(\n { name: 'Max Hedgehog' }, // $set properties\n { initial_url: '/blog' } // $set_once properties\n)\n\n\n\n",
"id": "set_properties",
"name": "set properties"
}
],
"params": [
{
"description": "Optional: An associative array of properties to store about the user. Note: For feature flag evaluations, if the same key is present in the userPropertiesToSetOnce, it will be overwritten by the value in userPropertiesToSet.",
"isOptional": true,
"type": "Properties",
"name": "userPropertiesToSet"
},
{
"description": "Optional: An associative array of properties to store about the user. If property is previously set, this does not override that value.",
"isOptional": true,
"type": "Properties",
"name": "userPropertiesToSetOnce"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Feature flags",
"description": "Sometimes, you might want to evaluate feature flags using properties that haven't been ingested yet, or were set incorrectly earlier. You can do so by setting properties the flag depends on with these calls:",
"details": null,
"id": "setPersonPropertiesForFlags",
"showDocs": true,
"title": "setPersonPropertiesForFlags",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// Set properties\nposthog.setPersonPropertiesForFlags({'property1': 'value', property2: 'value2'})\n\n\n",
"id": "set_properties",
"name": "Set properties"
},
{
"code": "\n\n// Set properties without reloading\nposthog.setPersonPropertiesForFlags({'property1': 'value', property2: 'value2'}, false)\n\n\n\n",
"id": "set_properties_without_reloading",
"name": "Set properties without reloading"
}
],
"params": [
{
"description": "The properties to override.",
"isOptional": false,
"type": "Properties",
"name": "properties"
},
{
"description": "Whether to reload feature flags.",
"isOptional": true,
"type": "boolean",
"name": "reloadFeatureFlags"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Session replay",
"description": "turns session recording on, and updates the config option `disable_session_recording` to false",
"details": null,
"id": "startSessionRecording",
"showDocs": true,
"title": "startSessionRecording",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// Start and ignore controls\nposthog.startSessionRecording(true)\n\n\n",
"id": "start_and_ignore_controls",
"name": "Start and ignore controls"
},
{
"code": "\n\n// Start and override controls\nposthog.startSessionRecording({\n // you don't have to send all of these\n sampling: true || false,\n linked_flag: true || false,\n url_trigger: true || false,\n event_trigger: true || false\n})\n\n\n\n",
"id": "start_and_override_controls",
"name": "Start and override controls"
}
],
"params": [
{
"description": "optional boolean to override the default sampling behavior - ensures the next session recording to start will not be skipped by sampling or linked_flag config. `true` is shorthand for sampling: true, linked_flag: true",
"isOptional": true,
"type": "{\n sampling?: boolean;\n linked_flag?: boolean;\n url_trigger?: true;\n event_trigger?: true;\n } | true",
"name": "override"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Session replay",
"description": "turns session recording off, and updates the config option disable_session_recording to true",
"details": null,
"id": "stopSessionRecording",
"showDocs": true,
"title": "stopSessionRecording",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// Stop session recording\nposthog.stopSessionRecording()\n\n\n\n",
"id": "stop_session_recording",
"name": "Stop session recording"
}
],
"params": [],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Capture",
"description": "Removes a session super property from the current session.",
"details": "This will stop the property from being automatically included in future events for this session. The property is removed from sessionStorage.",
"id": "unregister_for_session",
"showDocs": true,
"title": "unregister_for_session",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// remove a session property\nposthog.unregister_for_session('current_flow')\n\n\n\n",
"id": "remove_a_session_property",
"name": "remove a session property"
}
],
"params": [
{
"description": "The name of the session super property to remove",
"isOptional": false,
"type": "string",
"name": "property"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Capture",
"description": "Removes a super property from persistent storage.",
"details": "This will stop the property from being automatically included in future events. The property will be permanently removed from the user's profile.",
"id": "unregister",
"showDocs": true,
"title": "unregister",
"releaseTag": "public",
"examples": [
{
"code": "\n\n// remove a super property\nposthog.unregister('plan_type')\n\n\n\n",
"id": "remove_a_super_property",
"name": "remove a super property"
}
],
"params": [
{
"description": "The name of the super property to remove",
"isOptional": false,
"type": "string",
"name": "property"
}
],
"returnType": {
"id": "void",
"name": "void"
}
},
{
"category": "Feature flags",
"description": "Opt the user in or out of an early access feature. [Learn more in the docs](/docs/feature-flags/early-access-feature-management#option-2-custom-implementation)",
"details": null,
"id": "updateEarlyAccessFeatureEnrollment",
"showDocs": true,
"title": "updateEarlyAccessFeatureEnrollment",
"releaseTag": "public",
"examples": [
{
"code": "\n\nconst toggleBeta = (betaKey) => {\n if (activeBetas.some(\n beta => beta.flagKey === betaKey\n )) {\n posthog.updateEarlyAccessFeatureEnrollment(\n betaKey,\n false\n )\n setActiveBetas(\n prevActiveBetas => prevActiveBetas.filter(\n item => item.flagKey !== betaKey\n )\n );\n return\n }\n\n posthog.updateEarlyAccessFeatureEnrollment(\n betaKey,\n true\n )\n setInactiveBetas(\n prevInactiveBetas => prevInactiveBetas.filter(\n item => item.flagKey !== betaKey\n )\n );\n}\n\nconst registerInterest = (featureKey) => {\n posthog.updateEarlyAccessFeatureEnrollment(\n featureKey,\n true\n )\n // Update UI to show user has registered\n}\n\n\n\n",
"id": "",
"name": ""
}
],
"params": [
{
"description": "The key of the feature flag to update.",
"isOptional": false,
"type": "string",
"name": "key"
},
{
"description": "Whether the user is enrolled in the feature.",
"isOptional": false,
"type": "boolean",
"name": "isEnrolled"
},
{
"description": "The stage of the feature flag to update.",
"isOptional": true,
"type": "string",
"name": "stage"
}
],
"returnType": {
"id": "void",
"name": "void"
}
}
]
}
],
"categories": [
"Initialization",
"Identification",
"Capture",
"Surveys",
"Error tracking",
"LLM analytics",
"Privacy",
"Session replay",
"Feature flags",
"Toolbar"
]
}
