# Getting started with web analytics

Web analytics provides you with a simple dashboard of common website and app metrics.

This page covers the basic functionality and some common use cases, such as finding when users are most active.

## Where do I start?

The best way to get started is to open your [web analytics dashboard](https://app.posthog.com/web) and take a look at the data, which is all based on how people interact with your app or website.

<ProductScreenshot
  imageLight="https://res.cloudinary.com/dmukukwp6/image/upload/web_analytics_top_light_mode_2024_10_be53cf5325.png"
  imageDark="https://res.cloudinary.com/dmukukwp6/image/upload/web_analytics_top_dark_mode_2024_10_6aa6dc9aeb.png"
  alt="Web analytics dashboard"
  classes="rounded"
/>

At a glance, the dashboard has sections for all of the following data:

- **Visitors and pageviews:** How many people are coming to your website? How many pages do they visit?
- **Sessions and session duration:** How often do people visit? How long do they stay?
- **Paths:** What pages are they visiting?
- **Channels, referrers, and UTM parameters:** Where did they come from?
- **Demographic information:** What devices, browsers, and operating systems are they using? Where are they located?
- **Goals:** Are users performing the actions you want them to?

We'll dive into all these below.

## How do I use web analytics?

### Visitors, pageviews, and sessions

The first thing you'll see at the top of the web analytics dashboard is a graph of visitor data, which we can use to answer questions like:

- How many people are currently online _right now_?
- How many people visited in the last week, month, or custom time period?
- Is the number of visitors going up or down over a given time period?

What's the difference a between a visitor and a session?

- A [**session**](/docs/data/sessions) is a set of events for a single visit to your website. Sessions have a beginning, a duration, and an end.
- A **visitor** represents a single, unique person visiting your site.

In other words, a single visitor will have many sessions as they return to your website. And each session will likely have many pageviews as they move from page to page.

You can adjust the data on your web analytics dashboard to view last 24 hours, the last 7 days, the year-to-date, or any other custom time range.

In the screenshot below, we can see the last 30 days of traffic. You can also hover over the graph to see the value for the current period compared with the previous period.

<ProductScreenshot
  imageLight="https://res.cloudinary.com/dmukukwp6/image/upload/time_intervals_wide_2ce241b1c4.png"
  imageDark="https://res.cloudinary.com/dmukukwp6/image/upload/time_intervals_wide_dark_2256d417c6.png"
  alt="Time interval selection"
  classes="rounded"
/>

> **Use case: Finding when users are most active**
>
> If you have a weekly newsletter, you may want to send it to your readers at a time they're likely to be active and not miss it. PostHog has a newsletter called [_Product for Engineers_](https://newsletter.posthog.com), and we can use these graphs to make an educated guess about when users are most active.
>
> - Filtering by the "Last 30 days" and grouping by day reveals that Tuesdays and Wednesdays are the most active weekdays for our users, whereas Saturdays are the days with the least activity.
> - Filtering by the "Last 7 days" and grouping by hour shows the ideal time to send is between 10:00 a.m. and 4:00 p.m. EST.
>
> <ProductScreenshot
>  imageLight="https://res.cloudinary.com/dmukukwp6/image/upload/last_7_days_light_8ca2fe6345.png"
>  imageDark="https://res.cloudinary.com/dmukukwp6/image/upload/last_7_days_dark_d9273fa42c.png"
>  alt="Last 7 days by hour"
>  classes="rounded"
> />

### Paths

Paths show you all the specific pages accessed in your app or website, which can help answer questions like the following:

- What content is popular and effective?
- What is the last page people visit before leaving?
- What is the bounce rate for a particular page?

Bounce rate is the percentage of users who leave your page immediately after visiting. In other words, a bounce is when someone lands on a page, but doesn't interact with it and leaves within 10 seconds. For more information, we also have a tutorial available for [how to calculate bounce rate](/tutorials/bounce-rate).

<ProductScreenshot
  imageLight="https://res.cloudinary.com/dmukukwp6/image/upload/v1711580005/posthog.com/contents/images/docs/web-analytics/dashboard/paths-light.png"
  imageDark="https://res.cloudinary.com/dmukukwp6/image/upload/v1711580004/posthog.com/contents/images/docs/web-analytics/dashboard/paths-dark.png"
  alt="Paths"
  classes="rounded"
/>

You can drill down into specific pages and event properties using the **+ Add filter** button.

You'll have dozens or even hundreds of data points to use for filtering, but here are a handful of examples:

- filter where _Path Name_ is equal to `"/pricing"`
- filter where _Device Type_ is equal to `"Desktop"`
- filter where _Referrer URL_ contains `"youtube.com"`

The paths section of the dashboard also makes it easy to filter for specific pages. Instead of using the filter button, you can click on any of the paths in the list to filter the dashboard for that specific path.

This section also has tabs for finding the entry paths, end paths, and outbound clicks:

- **Entry path** shows stats for the first page a user saw when they opened your website
- **End path** shows stats for the last page a user visited before their session ended
- **Outbound clicks** show which links that users clicked on to leave your site

> **Use case: Finding the most popular content**
>
> PostHog hosts developer documentation at `/docs`. What if we want to find the most popular docs? We can click the **+ Add filter** button and add a filter where _Path Name_ contains `"/docs/"`. And then we can see the results with the most popular documentation:
>
> <ProductScreenshot
>  imageLight="https://res.cloudinary.com/dmukukwp6/image/upload/paths_docs_2924a8d630.png"
>  imageDark="https://res.cloudinary.com/dmukukwp6/image/upload/paths_docs_dark_1887fbb2c7.png"
>  alt="Most popular paths"
>  classes="rounded"
> />

### Channels, referrers, and UTM sources

The web analytics dashboard also enables you to find out where traffic is coming from.

#### Channels

Channels distinguish between different sources that are bringing traffic to your website. They're also sometimes called marketing channels or acquisition channels. Here are some examples:

- **Search:** visitors from a search engine like Google (you can also distinguish between traffic from organic search results and paid ads)
- **Social:** visitors from social media site
- **Referrals:** visitors that clicked a referral link (more on this below)
- **Direct:** visitors that went directly to your website (by typing the URL or clicking a bookmark for example)

This is just a small sample of the available channels to give you an idea of how to get started. There's a full list of available [channel types](/docs/data/channel-type), and you can define your own [custom channels](/docs/web-analytics/dashboard#custom-channel-type) as well.

#### Referrers

Referrers provides a list of the domains your visitors are coming from. For example, you'll see how many users came from `google.com`, `youtube.com`, or `ycombinator.com`. If a user visits your website directly without coming from somewhere else, it will show up as `$direct`.

<ProductScreenshot
  imageLight="https://res.cloudinary.com/dmukukwp6/image/upload/referrers_light_9d37babf9a.png"
  imageDark="https://res.cloudinary.com/dmukukwp6/image/upload/referrers_dark_8d458b5a66.png"
  alt="Referrers"
  classes="rounded"
/>

#### UTM parameters

UTM parameters are another way to get information about where people are coming from. By providing some structured values at the end of our URLs, we can segment visitors into groups.

For example, if you advertise a sale on Google, you can use the URL to indicate the `utm_source` and `utm_campaign`:

`posthog.com?utm_source=google,utm_campaign=summer-sale`

Web analytics enables you to filter by all the various UTM parameters that are available, and you can learn more about them in our [UTM segmentation](/docs/data/utm-segmentation) doc. We also have a tutorial on [how to track performance marketing](/tutorials/performance-marketing) that goes into more detail.

> **Use case: Tracking visitors from a sponsored video**
>
> One example of how PostHog uses these features was a recent sponsored video on YouTube. We sponsored a [Fireship](https://www.youtube.com/c/Fireship) video, and we can see how it worked below.
>
> For the YouTube video, there's a link in the description for people that are interested in seeing what PostHog is, and it looks like this:
>
> `https://posthog.com/fireship`
>
> That URL gets transformed into the following UTM paramaters:
>
> `https://posthog.com/?utm_source=fireship&utm_campaign=fireship`
>
> Then, we can see how many visitors came from that video by using the "UTM source" option on our web analytics dashboard:
>
> <ProductScreenshot
>  imageLight="https://res.cloudinary.com/dmukukwp6/image/upload/utm_source_light_21fa9c00fe.png"
>  imageDark="https://res.cloudinary.com/dmukukwp6/image/upload/utm_source_dark_eada0f8178.png"
>  alt="UTM sources"
>  classes="rounded"
> />

### Demographic information

Based on how users are accessing your website, web analytics also provides additional demographic metrics that can help answer the following:

- What kinds of devices are visitors using? Laptops? Tablets? Phones?
- Which browsers and operating systems are most popular?
- Where are users located geographically? Which countries? Which cities?
- What are the most popular languages for visitors?

### Goals

The goals section of the web analytics dashboard is all about tracking conversion goals.

A conversion is a key event or action you want users to do. If a user converted, it means they not only visited your website, but also performed some key action like signing up or subscribing.

You can click the **Add conversion goal** button at the top of the web analytics dashboard to create a new goal.

<ProductScreenshot
  imageLight="https://res.cloudinary.com/dmukukwp6/image/upload/Clean_Shot_2024_11_04_at_12_29_08_3bba14e7e9.png"
  imageDark="https://res.cloudinary.com/dmukukwp6/image/upload/Clean_Shot_2024_11_04_at_12_28_25_689e6c893d.png"
  alt="Conversion goal"
  classes="rounded"
/>

For a more detailed guide, check out the [conversion goals](/docs/web-analytics/conversion-goals) doc.

# JavaScript Web features

## Capturing events

By default, PostHog automatically captures pageviews and pageleaves as well as clicks, change of inputs, and form submissions associated with `a`, `button`, `form`, `input`, `select`, `textarea`, and `label` tags. See our [autocapture docs](/docs/product-analytics/autocapture) for more details on this.

If you prefer to disable or filter these, set the appropriate values in your [configuration options](/docs/libraries/js/config).

### Custom event capture

You can send custom events using `capture`:

```js-web
posthog.capture('user_signed_up');
```

> **Tip:** We recommend using a `[object] [verb]` format for your event names, where `[object]` is the entity that the behavior relates to, and `[verb]` is the behavior itself. For example, `project created`, `user signed up`, or `invite sent`.

### Setting event properties

Optionally, you can include additional information with the event by including a [properties](/docs/data/events#event-properties) object:

```js-web
posthog.capture('user_signed_up', {
    login_type: "email",
    is_free_trial: true
})
```

## Anonymous and identified events

PostHog captures two types of events: [**anonymous** and **identified**](/docs/data/anonymous-vs-identified-events)

**Identified events** enable you to attribute events to specific users, and attach [person properties](/docs/product-analytics/person-properties). They're best suited for logged-in users.

Scenarios where you want to capture identified events are:

- Tracking logged-in users in B2B and B2C SaaS apps
- Doing user segmented product analysis
- Growth and marketing teams wanting to analyze the _complete_ conversion lifecycle

**Anonymous events** are events without individually identifiable data. They're best suited for [web analytics](/docs/web-analytics) or apps where users aren't logged in.

Scenarios where you want to capture anonymous events are:

- Tracking a marketing website
- Content-focused sites
- B2C apps where users don't sign up or log in

Under the hood, the key difference between identified and anonymous events is that for identified events we create a [person profile](/docs/data/persons) for the user, whereas for anonymous events we do not.

> **Important:** Due to the reduced cost of processing them, anonymous events can be up to 4x cheaper than identified ones, so we recommended you only capture identified events when needed.

### Capturing anonymous events

The JavaScript Web SDK captures anonymous events by default. However, this may change depending on your [`person_profiles` config](/docs/libraries/js/config) when initializing PostHog:

1. `person_profiles: 'identified_only'` _(recommended)_ _(default)_ - Anonymous events are captured by default. PostHog only captures identified events for users where [person profiles](/docs/data/persons) have already been created.

2. `person_profiles: 'always'` - Capture identified events for all events.

For example:

```js-web
posthog.init('<ph_project_api_key>', {
    api_host: '<ph_client_api_host>',
    defaults: '<ph_posthog_js_defaults>',
    person_profiles: 'always'
})
```

### Capturing identified events

If you've set the [`personProfiles` config](/docs/libraries/js/config) to `IDENTIFIED_ONLY` (the default option), anonymous events are captured by default. To capture identified events, call any of the following functions:

- [`identify()`](/docs/product-analytics/identify)
- [`alias()`](/docs/product-analytics/identify#alias-assigning-multiple-distinct-ids-to-the-same-user)
- [`group()`](/docs/product-analytics/group-analytics)
- [`setPersonProperties()`](/docs/product-analytics/person-properties)
- [`setPersonPropertiesForFlags()`](/docs/libraries/js/features#overriding-server-properties)
- [`setGroupPropertiesForFlags()`](/docs/libraries/js/features#overriding-server-properties)

When you call any of these functions, it creates a [person profile](/docs/data/persons) for the user. Once this profile is created, all subsequent events for this user will be captured as identified events.

Alternatively, you can set `personProfiles` to `ALWAYS` to capture identified events by default.

#### Identifying users

The most useful of these methods is `identify`. We strongly recommend reading our doc on [identifying users](/docs/product-analytics/identify) to better understand how to correctly use it.

Using `identify`, you can capture identified events associated with specific users. This enables you to understand how they're using your product across different sessions, devices, and platforms.

```js-web
posthog.identify(
    'distinct_id', // Required. Replace 'distinct_id' with your user's unique identifier
    { email: 'max@hedgehogmail.com', name: 'Max Hedgehog' },  // $set, optional
    { first_visited_url: '/blog' } // $set_once, optional
);
```

Calling `identify` creates a person profile if one doesn't exist already. This means all events for that distinct ID count as identified events.

You can get the distinct ID of the current user by calling `posthog.get_distinct_id()`.

## Setting person properties

To set [person properties](/docs/data/user-properties) in these profiles, include them when capturing an event:

```js-web
posthog.capture(
  'event_name',
  {
    $set: { name: 'Max Hedgehog'  },
    $set_once: { initial_url: '/blog' },
  }
)
```

Typically, person properties are set when an event occurs like `user updated email` but there may be occasions where you want to set person properties as its own event.

```js
posthog.setPersonProperties(
  { name: "Max Hedgehog" }, // These properties are like the `$set` from above
  { initial_url: "/blog" } // These properties are like the `$set_once` from above
);
```

This creates a special `$set` event that is sent to PostHog. For more details on the difference between `$set` and `$set_once`, see our [person properties docs](/docs/data/user-properties#what-is-the-difference-between-set-and-set_once).

## Resetting a user

If a user logs out or switches accounts, you should call `reset` to unlink any future events made on that device with that user. This prevents multiple users from being grouped together due to shared cookies between sessions. **We recommend you call `reset` on logout even if you don't expect users to share a computer.**

You can do that like so:

```js-web
posthog.reset()
```

If you _also_ want to reset `device_id`, you can pass `true` as a parameter:

```js-web
posthog.reset(true)
```

This also resets group analytics.

## Alias

Sometimes, you want to assign multiple distinct IDs to a single user. This is helpful when your primary distinct ID is inaccessible. For example, if a distinct ID used on the frontend is not available in your backend.

In this case, you can use `alias` to assign another distinct ID to the same user.

```js-web
posthog.alias('alias_id', 'distinct_id');
```

We recommend reading our docs on [alias](/docs/data/identify#alias-assigning-multiple-distinct-ids-to-the-same-user) to best understand how to correctly use this method.

## Group analytics

[Group analytics](/docs/product-analytics/group-analytics) enables you to associate the events for that person's session with a group (e.g. teams, organizations, etc.).

> **Note:** This is a paid feature and is not available on the open-source or free cloud plan. Learn more [here](/pricing).

This is done by calling the `group` method with a group type and group ID.

```js-web
posthog.group('company', 'company_id_in_your_db')

posthog.capture('upgraded_plan') // this event is associated with company ID `company_id_in_your_db`
```

You can also set group properties by passing a third argument to the `group` method.

```js-web
posthog.group('company', 'company_id_in_your_db', {
    name: 'Awesome Inc.',
    employees: 11,
})
```

The `name` is a special property used in the PostHog UI for the name of the group. If you don't specify a `name` property, the group ID is used instead.

## Super properties

Super properties are properties associated with events that are set once and then sent with every `capture` call across sessions, be it a `$pageview`, an autocaptured button click, or anything else.

They are set using `posthog.register`, which takes a properties object as a parameter like this:

```js-web
posthog.register({
    'icecream_pref': 'vanilla',
})
```

The call above ensures that every event sent includes a `"icecream pref": "vanilla"` property. This way, if you filtered events by property using `icecream_pref = vanilla`, it would display all events captured on that user after the `posthog.register` call, since they all include the specified super property.

This does **not** set a person or group property. It only sets the properties on events.

Furthermore, if you register the same property multiple times, the next event will use the new value of that property. If you want to register a property only once (e.g. for ad campaign properties), you can use `register_once`, like so:

```js-web
posthog.register_once({
    'campaign_source': 'twitter',
})
```

Using `register_once` ensures that if a property is already set, it is not set again. For example, if the user already has property `"icecream_pref": "vanilla"`, calling `posthog.register_once({"icecream_pref": "chocolate"})` will **not** update the property.

### Removing stored super properties

Setting super properties creates a cookie on the client with the respective properties and their values. To stop sending a super property with events and remove the cookie, you can use `posthog.unregister`, like so:

```js-web
posthog.unregister('icecream_pref')
```

This removes the super property and subsequent events will not include it.

## Feature flags

PostHog's [feature flags](/docs/feature-flags) enable you to safely deploy and roll back new features as well as target specific users and groups with them.

### Boolean feature flags

```js-web
if (posthog.isFeatureEnabled('flag-key') ) {
    // Do something differently for this user

    // Optional: fetch the payload
    const matchedFlagPayload = posthog.getFeatureFlagPayload('flag-key')
}
```

### Multivariate feature flags

```js-web
if (posthog.getFeatureFlag('flag-key')  == 'variant-key') { // replace 'variant-key' with the key of your variant
    // Do something differently for this user

    // Optional: fetch the payload
    const matchedFlagPayload = posthog.getFeatureFlagPayload('flag-key')
}
```

### Ensuring flags are loaded before usage

Every time a user loads a page, we send a request in the background to fetch the feature flags that apply to that user. We store those flags in your chosen persistence option (local storage by default).

This means that for most pages, the feature flags are available immediately — **except for the first time a user visits**.

To handle this, you can use the `onFeatureFlags` callback to wait for the feature flag request to finish:

```js-web
posthog.onFeatureFlags(function (flags, flagVariants, { errorsLoading }) {
    // feature flags are guaranteed to be available at this point
    if (posthog.isFeatureEnabled('flag-key')) {
        // do something
    }
})
```

#### Callback parameters

The `onFeatureFlags` callback receives the following parameters:

- `flags: string[]`: An object containing the feature flags that apply to the user.

- `flagVariants: Record<string, string | boolean>`: An object containing the variants that apply to the user.

- `{ errorsLoading }: { errorsLoading?: boolean }`: An object containing a boolean indicating if an error occurred during the request to load the feature flags. This is `true` if the request timed out or if there was an error. It will be `false` or `undefined` if the request was successful.

You won't usually need to use these, but they are useful if you want to be extra careful about feature flags not being loaded yet because of a network error and/or a network timeout (see `feature_flag_request_timeout_ms`).

### Reloading feature flags

Feature flag values are cached. If something has changed with your user and you'd like to refetch their flag values, call:

```js-web
posthog.reloadFeatureFlags()
```

### Overriding server properties

Sometimes, you might want to evaluate feature flags using properties that haven't been ingested yet, or were set incorrectly earlier. You can do so by setting properties the flag depends on with these calls:

```js-web
posthog.setPersonPropertiesForFlags({'property1': 'value', property2: 'value2'})
```

> **Note:** These are set for the entire session. Successive calls are additive: all properties you set are combined together and sent for flag evaluation.

Whenever you set these properties, we also trigger a reload of feature flags to ensure we have the latest values. You can disable this by passing in the optional parameter for reloading:

```js-web
posthog.setPersonPropertiesForFlags({'property1': 'value', property2: 'value2'}, false)
```

At any point, you can reset these properties by calling `resetPersonPropertiesForFlags`:

```js-web
posthog.resetPersonPropertiesForFlags()
```

The same holds for [group](/manual/group-analytics) properties:

```js-web
// set properties for a group
posthog.setGroupPropertiesForFlags({'company': {'property1': 'value', property2: 'value2'}})

// reset properties for a given group:
posthog.resetGroupPropertiesForFlags('company')

// reset properties for all groups:
posthog.resetGroupPropertiesForFlags()
```

> **Note:** You don't need to add the group names here, since these properties are automatically attached to the current group (set via `posthog.group()`). When you change the group, these properties are reset.

#### Automatic overrides

Whenever you call `posthog.identify` with person properties, we automatically add these properties to flag evaluation calls to help determine the correct flag values. The same is true for when you call `posthog.group()`.

#### Default overridden properties

By default, we always override some properties based on the user IP address.

The list of properties that this overrides:

1. `$geoip_city_name`
2. `$geoip_country_name`
3. `$geoip_country_code`
4. `$geoip_continent_name`
5. `$geoip_continent_code`
6. `$geoip_postal_code`
7. `$geoip_time_zone`

This enables any geolocation-based flags to work without manually setting these properties.

### Request timeout

You can configure the `feature_flag_request_timeout_ms` parameter when initializing your PostHog client to set a flag request timeout. This helps prevent your code from being blocked in the case when PostHog's servers are too slow to respond. By default, this is set at 3 seconds.

```js
posthog.init('<ph_project_api_key>', {
  api_host: '<ph_client_api_host>',
  defaults: '<ph_posthog_js_defaults>'
  feature_flag_request_timeout_ms: 3000 // Time in milliseconds. Default is 3000 (3 seconds).
})
```

### Feature flag error handling

When using the PostHog SDK, it's important to handle potential errors that may occur during feature flag operations. Here's an example of how to wrap PostHog SDK methods in an error handler:

```js
function handleFeatureFlag(client, flagKey, distinctId) {
  try {
    const isEnabled = client.isFeatureEnabled(flagKey, distinctId);
    console.log(
      `Feature flag '${flagKey}' for user '${distinctId}' is ${isEnabled ? "enabled" : "disabled"}`
    );
    return isEnabled;
  } catch (error) {
    console.error(`Error fetching feature flag '${flagKey}': ${error.message}`);
    // Optionally, you can return a default value or throw the error
    // return false; // Default to disabled
    throw error;
  }
}

// Usage example
try {
  const flagEnabled = handleFeatureFlag(client, "new-feature", "user-123");
  if (flagEnabled) {
    // Implement new feature logic
  } else {
    // Implement old feature logic
  }
} catch (error) {
  // Handle the error at a higher level
  console.error("Feature flag check failed, using default behavior");
  // Implement fallback logic
}
```

### Bootstrapping flags

Since there is a delay between initializing PostHog and fetching feature flags, feature flags are not always available immediately. This makes them unusable if you want to do something like redirecting a user to a different page based on a feature flag.

To have your feature flags available immediately, you can initialize PostHog with precomputed values until it has had a chance to fetch them. This is called bootstrapping. After the SDK fetches feature flags from PostHog, it will use those flag values instead of bootstrapped ones.

For details on how to implement bootstrapping, see our [bootstrapping guide](/docs/feature-flags/bootstrapping).

### Enriched flag analytics

You can send enriched analytics data for feature flags to help uncover replays where people interact with a flag, target people who've interacted with a feature, or build cohorts of people who've viewed a feature.

To enable this, you can either use our `<PosthogFeature>` [React component](/docs/libraries/react#feature-flags-react-component) (which implements this for you), or implement it yourself.

To do it yourself, there are 3 things you need to do:

1. Whenever a feature is viewed, send the `$feature_view` event with the property `feature_flag` set to the name of the flag.

```javascript
posthog.capture("$feature_view", { feature_flag: flag });
```

2. Whenever someone interacts with a feature, send a `$feature_interaction` event with the property `feature_flag` set to the name of the flag.

3. At the same time, set the person property `$feature_interaction/<flag-key>` to true.

```javascript
posthog.capture("$feature_interaction", {
  feature_flag: flag,
  $set: { [`$feature_interaction/${flag}`]: true },
});
```

See [the React component](https://github.com/PostHog/posthog-js/blob/master/react/src/components/PostHogFeature.tsx#L48C10-L48C35) for another example.

## Experiments (A/B tests)

Since [experiments](/docs/experiments/manual) use feature flags, the code for running an experiment is very similar to the feature flags code:

```js-web
// Ensure flags are loaded before usage.
// You'll only need to call this on the code the first time a user visits.
// See this doc for more details: /docs/feature-flags/manual#ensuring-flags-are-loaded-before-usage
posthog.onFeatureFlags(function() {
  // feature flags should be available at this point
  if (posthog.getFeatureFlag('experiment-feature-flag-key')  == 'variant-name') {
    // do something
  }
})

// Otherwise, you can just do:
if (posthog.getFeatureFlag('experiment-feature-flag-key')  == 'variant-name') {
  // do something
}

// You can also test your code by overriding the feature flag:
// e.g., posthog.featureFlags.overrideFeatureFlags({ flags: {'experiment-feature-flag-key': 'test'}})
```

It's also possible to [run experiments without using feature flags](/docs/experiments/running-experiments-without-feature-flags).

## Early access feature management

Early access features give you the option to release feature flags that can be controlled by your users. More information on this can be found [here](/docs/feature-flags/early-access-feature-management).

```js-web
posthog.getEarlyAccessFeatures((previewItemData) => {
  // do something with early access feature
})
```

```js-web
posthog.updateEarlyAccessFeatureEnrollment(flagKey, 'true')
```

## Surveys

[Surveys](/docs/surveys) launched with [popover presentation](/docs/surveys/creating-surveys#presentation) are automatically shown to users matching the [display conditions](/docs/surveys/creating-surveys#display-conditions) you set up.

You can also [render _unstyled_ surveys programmatically](/docs/surveys/implementing-custom-surveys) with the `renderSurvey` method.

```js-web
posthog.renderSurvey('survey_id', '#survey-container')
```

To disable loading surveys in a specific client, you can set the `disable_surveys` [config option](/docs/libraries/js/config).

Surveys using the **API** presentation enables you to implement your own survey UI and use PostHog to handle display logic, capturing results, and analytics.

To implement **API** surveys, start by fetching active surveys for a user using either of the methods below:

```js-web
// Fetch enabled surveys for the current user
posthog.getActiveMatchingSurveys(callback, forceReload)

// Fetch all surveys
posthog.getSurveys(callback, forceReload)
```

The response returns an array of survey objects and is cached by default. To force a reload, pass `true` as the `forceReload` argument.

The survey objects look like this:

```json
[
  {
    "id": "your_survey_id",
    "name": "Your survey name",
    "description": "Metadata describing your survey",
    "type": "api", // either "api", "popover", or "widget"
    "linked_flag_key": null, // linked feature flag key, if any.
    "targeting_flag_key": "your_survey_targeting_flag_key",
    "questions": [
      {
        "type": "single_choice",
        "choices": ["Yes", "No"],
        "question": "Are you enjoying PostHog?"
      }
    ],
    "conditions": null,
    "start_date": "2023-09-19T13:10:49.505000Z",
    "end_date": null
  }
]
```

### Capturing survey events

To capture survey results properly in PostHog, you need to capture 3 types of events:

```js-web
// 1. When a user is shown a survey
posthog.capture("survey shown", {
  $survey_id: survey.id // required
})

// 2. When a user has dismissed a survey
posthog.capture("survey dismissed", {
  $survey_id: survey.id // required
})

// 3. When a user has responded to a survey
posthog.capture("survey sent", {
  $survey_id: survey.id, // required
  $survey_questions: [
    {
      id: "d8462827-1575-4e1e-ab1d-b5fddd9f829c",
      question: "What is your favorite color?",
    }
  ]
  $survey_response_d8462827-1575-4e1e-ab1d-b5fddd9f829c: survey_response // required. `survey_response` must be a text value.
  // Convert numbers to text e.g. 8 should be converted to "8".
  // For multiple choice select surveys, `survey_response` must be an array of values with the selected choices.
  // e.g., $survey_response_d8462827-1575-4e1e-ab1d-b5fddd9f829c: ["response_1", "response_2"]
})
```

## Session replay

To set up [session replay](/docs/session-replay) in your project, all you need to do is install the JavaScript web library and enable "Record user sessions" in [your project settings](https://us.posthog.com/settings/project-replay).

For [fine-tuning control](/docs/session-replay/how-to-control-which-sessions-you-record) of which sessions you record, you can use [feature flags](/docs/session-replay/how-to-control-which-sessions-you-record#with-feature-flags), [sampling](/docs/session-replay/how-to-control-which-sessions-you-record#sampling), [minimum duration](/docs/session-replay/how-to-control-which-sessions-you-record#minimum-duration), or set the `disable_session_recording` [config option](/docs/libraries/js/config) and use the following methods:

```js-web
// Turns session recording on
posthog.startSessionRecording()

// Turns session recording off
posthog.stopSessionRecording()

// Check if session recording is currently running
posthog.sessionRecordingStarted()
```

If you are using feature flags or sampling to control which sessions you record, you can override the default behavior (and start a recording regardless) by passing the `linked_flag` or `sampling` overrides. The following would start a recording for all users, even if they don't match the flag or aren't in the sample:

```js-web
posthog.startSessionRecording({ linked_flag: true, sampling: true })
```

To get the playback URL of the current session replay, you can use the following method:

```js-web
posthog.get_session_replay_url(
  { withTimestamp: true, timestampLookBack: 30 }
)
```

It has two optional parameters:

- `withTimestamp` (default: `false`): When set to `true`, the URL includes a timestamp that takes you to the session at the time of the event.
- `timestampLookBack` (default: `10`): The number of seconds back the timestamp links to.

Session replay uses [rrweb](https://github.com/rrweb-io/rrweb) under the hood, which is configurable with the `session_recording` parameter.

The documentation and defaults for these options can be found in the [rrweb docs](https://github.com/rrweb-io/rrweb/blob/master/guide.md#options).

The defaults are the same as in rrweb, except for these fields:

| key           | PostHog default   | description                                                                                                                                                          |
| ------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| blockClass    | 'ph-no-capture'   | Use a string or RegExp to configure which elements should be blocked, refer to the [privacy](https://github.com/rrweb-io/rrweb/blob/master/guide.md#privacy) chapter |
| ignoreClass   | 'ph-ignore-input' | Use a string or RegExp to configure which elements should be ignored, refer to the [privacy](https://github.com/rrweb-io/rrweb/blob/master/guide.md#privacy) chapter |
| maskTextClass | 'ph-mask'         | Use a string or RegExp to configure which elements should be masked, refer to the [privacy](https://github.com/rrweb-io/rrweb/blob/master/guide.md#privacy) chapter  |
| maskAllInputs | true              | mask all input content as \*                                                                                                                                         |

The defaults for `maskAllInputs`, `maskTextSelector` and `blockSelector` will change depending on your masking configuration in the session replay section of [your project settings](https://us.posthog.com/settings/project-replay#replay-masking).

## Error tracking

You can enable [exception autocapture](/docs/error-tracking/installation) in the **Autocapture & heatmaps** section of [your project settings](https://us.posthog.com/settings/project-autocapture#exception-autocapture). When enabled, this automatically captures `$exception` events when errors are thrown.

It is also possible to manually capture exceptions using the `captureException` method:

```js
posthog.captureException(error, additionalProperties);
```

## Amending or sampling events

Since version 1.187.0, you can provide a `before_send` function when initializing the SDK to amend, filter, sample, or reject events before they are sent to PostHog.

> **🚨 Warning:** Amending and sampling events is advanced functionality that requires careful implementation. Core PostHog features may require 100% of unmodified events to function properly. We recommend only modifying or sampling your own custom events if possible, and preserving all PostHog internal events in their original form.

### Redacting information in events

`before_send` gives you one place to edit or redact information before it is sent to PostHog. For example:

<details>
<summary>Redact URLs in event properties</summary>

```ts
posthog.init("<ph_project_api_key>", {
  before_send: (event: CaptureResult | null): CaptureResult | null => {
    if (!event) {
      return null;
    }

    // redacting URLs will be specific to your site structure
    function redactUrl(value: string): string {
      return value.replace(/project\/\d+/, "project/1234567");
    }

    // NB these functions are examples and you should implement something specific to your site
    // redacting information can impact features that rely on it, e.g. heatmaps are keyed by URL
    function redactArray(value: any[]) {
      return value.map((v) => {
        if (typeof v === "string") {
          return redactUrl(v);
        } else if (Array.isArray(v)) {
          return redactArray(v);
        } else if (typeof v === "object" && v) {
          return redactObject(v);
        } else {
          return v;
        }
      });
    }

    // NB these functions are examples and you should implement something specific to your site
    // redacting information can impact features that rely on it, e.g. heatmaps are keyed by URL
    function redactObject(
      objectToRedact: Record<string, any>
    ): Record<string, any> {
      return Object.entries(objectToRedact).reduce((acc, [key, value]) => {
        if (
          (key.includes("url") || key.includes("href")) &&
          typeof value === "string"
        ) {
          acc[key] = redactUrl(value);
        } else if (Array.isArray(value)) {
          acc[key] = redactArray(value);
        } else if (typeof value === "object" && value) {
          acc[key] = redactObject(value);
        } else {
          acc[key] = value;
        }
        return acc;
      }, {});
    }

    const redactedProperties = redactObject(event.properties || {});
    event.properties = redactedProperties;

    const redactedSet = redactObject(event.$set || {});
    event.$set = redactedSet;

    const redactedSetOnce = redactObject(event.$set_once || {});
    event.$set_once = redactedSetOnce;

    return event;
  },
});
```

</details>

<details>
<summary>Redact person properties in $set or $set_once</summary>

```ts
posthog.init("<ph_project_api_key>", {
  before_send: (event: CaptureResult | null): CaptureResult | null => {
    if (!event) {
      return null;
    }

    event.$set = {
      ...event.$set,
      name: "secret name",
    };
    event.$set_once = {
      ...event.$set_once,
      initial_name: "secret name",
    };

    return event;
  },
});
```

</details>

### Sampling events

Sampling lets you choose to send only a percentage of events to PostHog. It is a good way to control your costs without having to completely turn off features of the SDK.

Some functions of PostHog, for example much of web analytics, rely on receiving all events. Sampling `$pageview ` or `$pageleave` events in particular can cause unexpected results.

#### Sampling events using our provided customization

We offer a pre-built `sampleByEvent` function to sample by event name. You can import this using a package manager, or add the customization script to your site.

<MultiLanguage>

```ts file=Import
import { sampleByEvent } from "posthog-js/lib/src/customizations";

posthog.init("<ph_project_api_key>", {
  // capture only half of dead click and web vitals events
  before_send: sampleByEvent(["$dead_click", "$web_vitals"], 0.5),
});
```

```tsx file=Script
// Add this script to your site, may need to change the script src to match your API host:
// <script type="text/javascript" src="https://us.i.posthog.com/static/customizations.full.js"></script>

posthog.init("<ph_project_api_key>", {
  // capture only half of dead click and web vitals events
  before_send: posthogCustomizations.sampleByEvent(
    ["$dead_click", "$web_vitals"],
    0.5
  ),
});
```

</MultiLanguage>

This can be used to sample events by name, distinct ID, session ID, or custom function.

<details>
<summary>Send no events while developing</summary>

When working locally it can be useful to see what PostHog would do, without actually sending the data to PostHog

```ts
posthog.init("<ph_project_api_key>", {
  before_send: (event: CaptureResult | null): CaptureResult | null => {
    if (event) {
      console.log("posthog event: " + event.event, event);
    }
    return null;
  },
});
```

</details>

<details>
<summary>Sampling by person distinct ID</summary>

We offer a pre-built `sampleByDistinctId` function to sample a percentage of events by person distinct ID (in the example below, 40% of events). You can import this using a package manager, or add the customization script to your site.

> **Note:** A particular distinct ID will always either send all events or no events.

<MultiLanguage>

```ts file=Import
import { sampleByDistinctId } from "posthog-js/lib/src/customizations";

posthog.init("<ph_project_api_key>", {
  before_send: sampleByDistinctId(0.4),
});
```

```ts file=Script
// Add this script to your site, may need to change the script src to match your API host:
// <script type="text/javascript" src="https://us.i.posthog.com/static/customizations.full.js"></script>

posthog.init("<ph_project_api_key>", {
  before_send: posthogCustomizations.sampleByDistinctId(0.4),
});
```

</MultiLanguage>

</details>

<details>
<summary>Sampling by session ID</summary>

We offer a pre-built `sampleBySessionId` function to sample a percentage of events by session ID (in the example below, 25% of events). You can import this using a package manager, or add the customization script to your site.

> **Note:** A particular session ID will always either send all events or no events.

<MultiLanguage>

```ts file=Import
import { sampleBySessionId } from "posthog-js/lib/src/customizations";

posthog.init("<ph_project_api_key>", {
  before_send: sampleBySessionId(0.25),
});
```

```ts file=Script
// Add this script to your site, may need to change the script src to match your API host:
// <script type="text/javascript" src="https://us.i.posthog.com/static/customizations.full.js"></script>

posthog.init("<ph_project_api_key>", {
  before_send: posthogCustomizations.sampleBySessionId(0.25),
});
```

</MultiLanguage>

</details>

<details>
<summary>Sampling events using a custom function</summary>

If none of the provided sampling functions meet your needs, you can provide a custom function to sample events.

```ts
posthog.init("<ph_project_api_key>", {
  before_send: (event: CaptureResult | null): CaptureResult | null => {
    if (!event) {
      return null;
    }

    let sampleRate = 1.0; // default to always returning the event
    if (event.event === "$heatmap") {
      sampleRate = 0.1;
    }
    if (event.event === "$dead_click") {
      sampleRate = 0.01;
    }
    return Math.random() < sampleRate ? event : null;
  },
});
```

</details>

### Chaining before_send functions

You can provide an array of functions to be called one after the other:

```ts
posthog.init("<ph_project_api_key>", {
  before_send: [
    sampleByDistinctId(0.5), // only half of people
    sampleByEvent(["$web_vitals"], 0.1), // and they capture all events except 10% of web vitals
    sampleByEvent(["$$heatmap"], 0.5), // and 50% of heatmaps
  ],
});
```

## Blocking bad actors

PostHog tries to automatically block known crawlers and web/AI agents. It's a fact, however, that not every crawler will advertise themselves as a crawler.

If you see an unusual number of visitors in your project, you can try and understand where they're coming from by using [web analytics](https://us.posthog.com/web). It's common, however, that they will all contain the exact same user agent string. You can verify the most common user agents by using [this trend insight](https://app.posthog.com/insights/new#q=%7B%22kind%22%3A%22InsightVizNode%22%2C%22source%22%3A%7B%22kind%22%3A%22TrendsQuery%22%2C%22series%22%3A%5B%7B%22kind%22%3A%22EventsNode%22%2C%22name%22%3A%22%24pageview%22%2C%22event%22%3A%22%24pageview%22%2C%22math%22%3A%22total%22%7D%5D%2C%22trendsFilter%22%3A%7B%7D%2C%22breakdownFilter%22%3A%7B%22breakdowns%22%3A%5B%7B%22property%22%3A%22%24raw_user_agent%22%2C%22type%22%3A%22event%22%7D%5D%7D%7D%7D%20).

If a specific user agent is causing problems (many more events than other user agents), you can block it by adding it to `custom_blocked_useragents` in your PostHog initialization:

```ts
posthog.init("<ph_project_api_key>", {
  custom_blocked_useragents: ["<user_agent_string>"],
});
```

### Lighthouse audits

Lighthouse is known for not advertising itself. If you're using a tool that uses Lighthouse to monitor your website (or if a competitor does), PostHog won't be able to prevent those events by default, which might skew your numbers. Ahrefs and Semrush are examples of this.

Lighthouse user agents are well-known but they're not blocked by default because they represent possibly legitimate users. If you're experiencing a high number of events from these sources, you can block them by adding them to your `custom_blocked_useragents` list in your PostHog initialization:

```ts
const LIGHTHOUSE_USER_AGENTS = [
  "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
];

posthog.init("<ph_project_api_key>", {
  custom_blocked_useragents: LIGHTHOUSE_USER_AGENTS,
});
```

### Removing already ingested events

Deleting already ingested events is complicated, but you can add user agents to the [internal and test accounts filter](https://us.posthog.com/settings/project-product-analytics#internal-user-filtering) in your project settings to filter them from your analytics.

# Web analytics dashboard

The web analytics dashboard provides an overview of your website's traffic.

For the selected time range, it starts with the number of visitors, views, [sessions](/docs/data/sessions), along with trends for each, as well as average session duration and bounce rate. Each of these is compared with the previous time range, showing how much they increased or decreased.

<ProductScreenshot
  imageLight = "https://res.cloudinary.com/dmukukwp6/image/upload/web_analytics_top_light_mode_2024_10_be53cf5325.png"
  imageDark = "https://res.cloudinary.com/dmukukwp6/image/upload/web_analytics_top_dark_mode_2024_10_6aa6dc9aeb.png"
  alt="Web analytics dashboard" 
  classes="rounded"
/>

If you add a [conversion goal](/docs/web-analytics/conversion-goals), you can see the number of conversions and conversion rate as well.

## Bounce rate

A bounce is a session where the user only had one pageview, no autocaptures, and spent less than 10 seconds on the page. Your bounce rate is the percentage of sessions that resulted in a bounce.

PostHog uses autocaptured events to calculate this. To make sure this value is accurate, make sure you enable [autocapture](/docs/product-analytics/autocapture) and are capturing both `$pageleave` and `$autocapture` events.

You can change the duration threshold in the [web analytics settings](https://app.posthog.com/settings/project-web-analytics).

## LCP Score

[Largest contentful paint (LCP)](https://web.dev/articles/lcp) is a web vital metric that measures how long it takes for the largest content element on a page to load.

To calculate the score, we take the 75th percentile of the LCP values for the first pageview of each session. A good LCP score is less than 2.5 seconds, and a poor score is more than 4 seconds.

## Paths

Top paths drill down into specific pages on your site to show their views, visitors, bounce rate, and scroll depth. You can click on any of the paths to filter the dashboard for that path.

<ProductScreenshot
  imageLight = "https://res.cloudinary.com/dmukukwp6/image/upload/v1711580005/posthog.com/contents/images/docs/web-analytics/dashboard/paths-light.png" 
  imageDark = "https://res.cloudinary.com/dmukukwp6/image/upload/v1711580004/posthog.com/contents/images/docs/web-analytics/dashboard/paths-dark.png"
  alt="Web analytics dashboard" 
  classes="rounded"
/>

Entry and end paths show these stats for the first and last pageviews of each session, while outbound clicks shows the URLs that users clicked on to leave your site.

### Scroll depth

Both average scroll and deep scroll rate are calculated using how far a user has scrolled down the page and how much content has scrolled into view.

- **Average scroll depth** is the average scroll percentage across pageviews.
- **Deep scroll rate** is the percentage of users who scroll far enough down a page to view 80% of the content.

## Channels, referrers, UTMs

To get an idea of where users are visiting your site from, you can see top referrers, [channels](/docs/data/channel-type), and [UTMs](/docs/data/utm-segmentation).

<ProductScreenshot
  imageLight = "https://res.cloudinary.com/dmukukwp6/image/upload/v1711580002/posthog.com/contents/images/docs/web-analytics/dashboard/referrers-light.png" 
  imageDark = "https://res.cloudinary.com/dmukukwp6/image/upload/v1711580002/posthog.com/contents/images/docs/web-analytics/dashboard/referrers-dark.png"
  alt="Web analytics referrers" 
  classes="rounded"
/>

You can dive deeper into how your sessions are attributed using the [session attribution explorer](https://us.posthog.com/web/session-attribution-explorer). This shows the session count for each combination of channel type, referrer, and UTM as well as example entry URLs and the SQL query used to generate the data.

### Channel types

Based on UTMs, referring domains, and more, PostHog automatically classifies traffic into specific acquisition channel types such as:

| Channel Type     | Description of where the user came from                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| Direct           | Typed in the URL directly or used a saved link.                                 |
| Paid Search      | An ad from a search engine, e.g. Google, Bing, or Baidu.                        |
| Paid Social      | An ad from a social media platform, e.g. Facebook, LinkedIn, or Twitter         |
| Paid Video       | An ad from a video platform, e.g. YouTube or Twitch.                            |
| Paid Shopping    | An ad from a shopping platform, e.g. Amazon or eBay.                            |
| Paid Other       | An ad from an unknown platform.                                                 |
| Cross-Network    | A cross-network ad                                                              |
| Organic Search   | A non-ad search result from a search engine, e.g. Google, Bing, or Baidu.       |
| Organic Social   | A non-ad link from a social media platform, e.g. Facebook, LinkedIn, or Twitter |
| Organic Video    | A non-ad link from a video platform, e.g. YouTube or TikTok.                    |
| Organic Shopping | A non-ad link from a shopping platform, e.g. Amazon or eBay.                    |
| Affiliate        | An affiliate link.                                                              |
| Referral         | A referral link.                                                                |
| Email            | A link from an email.                                                           |
| Display          | A display ad, e.g. an ad on Google Display Network.                             |
| SMS              | A link from an SMS.                                                             |
| Audio            | An audio ad, e.g. a podcast ad.                                                 |
| Push             | A push notification.                                                            |
| Other            | A link from an unknown source.                                                  |

<ProductScreenshot
  imageLight = "https://res.cloudinary.com/dmukukwp6/image/upload/v1711580001/posthog.com/contents/images/docs/web-analytics/dashboard/channels-light.png" 
  imageDark = "https://res.cloudinary.com/dmukukwp6/image/upload/v1711580003/posthog.com/contents/images/docs/web-analytics/dashboard/channels-dark.png"
  alt="Web analytics channel types" 
  classes="rounded"
/>

> **Read more:** [How channel type is calculated](/docs/data/channel-type)

### Custom channel type

If our predefined channel types don't work for you, you can define rules to match incoming events to your own custom channel types in [your project settings](https://us.posthog.com/settings/project-web-analytics). The first matching rule is used, and if no rule matches (or if none are defined) then the default channel type is used.

For example, you could create an **AI** channel type where the referring domain equals `chatgpt.com`, `www.perplexity.ai`, and other AI services.

<ProductScreenshot
  imageLight = "https://res.cloudinary.com/dmukukwp6/image/upload/Clean_Shot_2024_12_04_at_16_48_30_2x_ea594a4d1c.png" 
  imageDark = "https://res.cloudinary.com/dmukukwp6/image/upload/Clean_Shot_2024_12_04_at_16_48_52_2x_12c92512c1.png"
  alt="Custom channel types" 
  classes="rounded"
/>

### UTMs

UTMs include source, medium, campaign, content, and term. Each are set as URL parameters and autocaptured by PostHog. For example, the following URL has the source of `twitter`, medium of `social`, and `campaign` of `twitter-campaign`:

`https://posthog.com/?utm_source=twitter&utm_medium=social&utm_campaign=twitter-campaign`

Setting UTMs correctly is crucial for accurately classifying your traffic, not only for UTMs, but for channel types as well.

> **Read more:** [How to capture, customize, and filter UTM parameters](/docs/data/utm-segmentation)

## World map

The world map shows where your users are located, but you can also select it to show top countries, regions (like California, England, or Ontario), cities, timezones, or languages.

<ProductScreenshot
  imageLight = "https://res.cloudinary.com/dmukukwp6/image/upload/v1711579999/posthog.com/contents/images/docs/web-analytics/dashboard/regions-light.png" 
  imageDark = "https://res.cloudinary.com/dmukukwp6/image/upload/v1711580000/posthog.com/contents/images/docs/web-analytics/dashboard/regions-dark.png"
  alt="Web analytics regions" 
  classes="rounded"
/>

## Retention

Retention creates a cohort of unique users who performed any event for the first time in the last week. It then tracks the percentage of users who return to perform any event in the following weeks.

<ProductScreenshot
  imageLight = "https://res.cloudinary.com/dmukukwp6/image/upload/v1711579998/posthog.com/contents/images/docs/web-analytics/dashboard/retention-light.png" 
  imageDark = "https://res.cloudinary.com/dmukukwp6/image/upload/v1711579997/posthog.com/contents/images/docs/web-analytics/dashboard/retention-dark.png"
  alt="Web analytics retention" 
  classes="rounded"
/>

> **Read more:** [Creating and understanding retention](/docs/product-analytics/retention)

## Active hours

The **Active hours** feature displays a heatmap showing either the number of **unique users** or **total pageviews** for **any pageview event**, broken down by hour of the day and day of the week You can switch between these two metrics using the tabs at the top right of the heatmap (**Unique users** or **Total pageviews**).

### What the heatmap shows:

- Each **cell** represents the number of unique users or total pageviews during a specific hour of a specific day. Numbers are formatted for readability (e.g., 1.73K for 1,730).
- The **"All" column** on the right aggregates the total for each day across all hours, and is highlighted in a different color.
- The **bottom row ("All")** aggregates the total for each hour across all days, also highlighted in a different color.
- The **bottom-right cell** shows the grand total for the selected metric (unique users or total pageviews) across all days and hours in the selected time range, with a distinct color.
- Use the **"Show more"** button to expand the heatmap and view additional details if available.
- The displayed time for each cell and the starting day of the week are based on your project's date and time settings. By default, the time is UTC, but you can change the timezone in [your project settings](https://us.posthog.com/settings/project-product-analytics#date-and-time).

<ProductScreenshot
  imageLight = "https://res.cloudinary.com/dmukukwp6/image/upload/Screenshot_2025_06_17_at_11_29_05_AM_b6492fe65e.png" 
  imageDark = "https://res.cloudinary.com/dmukukwp6/image/upload/Screenshot_2025_06_17_at_11_33_14_AM_653e33a4e7.png"
  alt="Web analytics active hours" 
  classes="rounded"
/>

> **Note:** Selecting a time range longer than 7 days will include additional occurrences of weekdays and hours, potentially increasing the counts in those buckets. For best results, select 7 closed days or a multiple of 7 closed day ranges.

## Goals

Goals shows your pinned or most recently created actions and the number of conversions they've had. You can set a custom event or action as a [conversion goal](/docs/web-analytics/conversion-goals) at the top of the dashboard for more specific metrics.

<ProductScreenshot
  imageLight = "https://res.cloudinary.com/dmukukwp6/image/upload/Clean_Shot_2024_11_06_at_16_03_42_2x_bb31331709.png" 
  imageDark = "https://res.cloudinary.com/dmukukwp6/image/upload/Clean_Shot_2024_11_06_at_16_03_56_2x_c46b405ffa.png"
  alt="Web analytics goals" 
  classes="rounded"
/>

## Filtering your dashboard

Like other dashboards in PostHog, the web analytics dashboard is filterable. This means you can filter for data with certain event or person property values. Options include browser, path name, device type, country, and UTMs. Just click the "Add filter" button next to the date range at the top of the dashboard.

This enables you to dive into specific stats for regions, parts of the site, and specific marketing campaigns.

For more complex queries, you can still use the product analytics tab as usual.

And for more on web analytics, check out our [getting started](/docs/web-analytics/getting-started) guide.

# Privacy controls

PostHog offers a range of controls to limit what data is captured by product analytics. They are listed below in order of least to most restrictive.

## EU-cloud hosting

PostHog offers hosting on EU cloud. To use this, sign up at [eu.posthog.com](https://eu.posthog.com).

If you've already created a US cloud instance and wish to migrate ticket, you must raise a [support ticket in-app](https://us.posthog.com/home#supportModal) with the **Data pipelines** topic for the PostHog team to do this migration for you. This option is **only available to customers on the boost, scale or enterprise** as it requires significant engineering time.  

## Disable sensitive information with autocapture

If you're using [autocapture](/docs/product-analytics/autocapture), PostHog automatically attempts to prevent sensitive data capture. We specifically only collect the `name`, `id`, and `class` attributes from input tags.

If there are specific elements you don't want to capture, add the [`ph-no-capture`](/docs/product-analytics/autocapture#preventing-sensitive-data-capture) class name.

```html
<button class='ph-no-capture'>Sensitive information here</button>
```

## Sanitize properties on the client

You can sanitize properties on the client side by setting the `before_send` [config](/docs/libraries/js/config) option. This is a function that enables you to modify the properties before they are sent to PostHog. You can even reject events by returning `null`. For example:

```js-web
posthog.init('<ph_project_api_key>', {
    api_host: '<ph_client_api_host>',
    defaults: '<ph_posthog_js_defaults>',
    before_send: function(event) {
        if (event.properties['$current_url']) {
            event.properties['$current_url'] = null;
        }

        return event;
    }
});
```

## Use the property filter app

You can use the [property filter app](/docs/cdp/property-filter) to prevent PostHog from certain properties on events. For example, you can configure the app to remove all GeoIP data from events.

We've also put together a [tutorial](/tutorials/property-filter) to help you get started with the app.

## Cookieless tracking

It's possible to use PostHog without cookies. Instead, PostHog can use in-memory storage. For more details on how to do this, read our tutorial on [how to set up cookieless tracking](/tutorials/cookieless-tracking).

## Complete opt-out

You can completely opt-out users from data capture. To do this, there are two options:

1. Opt users out by default in your PostHog initialization config.

<MultiLanguage>

```js-web
posthog.init('<ph_project_api_key>', {
    opt_out_capturing_by_default: true,
});
```

```ios_swift        
let config = PostHogConfig(apiKey: "<ph_project_api_key>", host: "<ph_client_api_host>")
config.optOut = true
PostHogSDK.shared.setup(config)
```

```android
val config = PostHogAndroidConfig(
    apiKey = <ph_project_api_key>,
    host = <ph_client_api_host> 
)
config.optOut = true
PostHogAndroid.setup(this, config)
```

```react-native
posthog.init('<ph_project_api_key>', {
    opt_out_capturing_by_default: true,
});
```

</MultiLanguage>

2. Opt users out on a per-person basis.

<MultiLanguage>

```js-web
posthog.opt_out_capturing()
```

```ios_swift        
PostHogSDK.shared.optOut()
```

```android
PostHog.optOut()
```

```react-native
posthog.opt_out_capturing()
```

</MultiLanguage>

Similarly, you can opt users in:

<MultiLanguage>

```js-web
posthog.opt_in_capturing()
```

```ios_swift        
PostHogSDK.shared.optIn()
```

```android
PostHog.optIn()
```

```react-native
posthog.opt_in_capturing()
```

</MultiLanguage>

To check if a user is opted out:

<MultiLanguage>

```js-web
posthog.has_opted_out_capturing()
```

```ios_swift        
PostHogSDK.shared.isOptOut()
```

```android
PostHog.isOptOut()
```

```react-native
posthog.has_opted_out_capturing()
```

</MultiLanguage>
