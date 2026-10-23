# Native review disposition

Disposition: native product and draft accepted for the observed geometry; internal beta delivered.
Delivered source: `d93e69614e4bf795c6cd020e5e466edeaef1010c`, version `1.11.0 (1)`.
Product source remains `43405c5b`; only the test query and reports changed afterward.
Review basis: production SwiftUI, synthetic native journeys and unmodified screenshots.
The rejected HTML concept is not a design reference.

## Native structure and state

The budget list uses system selection and split navigation, with year/annual-summary
access and semantic creation/planning actions. Root navigation respects active drafts;
nested routes retain their originating coordinator and the other tabs keep their stacks.
The stable sheet host survives column adaptation. The detail stack's selected-budget
boundary prevents the cold-revisit loading failure while preserving direct month changes.
Operation-level deletion batches preserve independent undo windows and cancellation.
No replacement loading framework, financial formula change or global UIKit styling is introduced.

## Surfaces and controls

The shared bar modifier keeps one structural shape while adapting to the actual vertical
edge. In vertical context it bounds the hero/pager backgrounds, leaves canvas under the
native title and uses the screen appearance. Horizontal rendering keeps the hero theme.
The six screen/skeleton backgrounds opt into horizontal safe areas; annual-summary cards do not.
The goal action retains its label, identifier and behavior, with the existing horizontal
button treatment and automatic vertical treatment. Local v12 images show the entire pencil
on a uniform disc in both landscapes, with a distinct light native sidebar.

The accepted 4.675:1 pencil/disc measurement is a sampled control result, not a universal
contrast certification. It excludes horizontal Back/status appearance, other controls,
and the SDK 27.1 rail. The separate native SDK 27.1 review below establishes the
observed rail contrast; local measurements alone do not prove it.

## Evidence and interpretation

- Earlier shared-logic checkpoint: 51 tests / 8 suites passed; evidence covers concurrency, navigation guards, reset and architecture at that checkpoint.
- Current v12 contracts: 20 tests / 2 suites passed; token and home contracts do not measure every rendered control.
- Current v12 strict journey: 1 pass, 326.401 s, exit 0; covers real iOS 26.5 rotations, navigation, template choices and preserved amount/description with keyboard.
- Native geometry checks require finite frames, full amount-group containment, keyboard presence/separation and non-overlap of visible amount content with required controls.
- Visual evidence: `/private/tmp/pulpe-ios-duo-native-v12-ui-attachments/`; source bundles are listed in `validation.md`.

The home pending-items view proves visible content, not manual pan behavior. A shortcut
may be unnecessary when the row is already visible. Budget screenshots after a gesture
do not prove sticky-pager visibility. Neither successful local rotations nor current-
geometry Duo automation establishes all five poses or any fold transition.
Broader accessibility, physical-device and older-system combinations are not certified.

## SDK 27.1 acceptance

The six native captures from product `43405c5b` show black titles on the canvas,
forest bounded below the title and outside the rail, and readable native controls.
Interior-pixel samples measure title 18.7:1, Back 18.1:1, goal pencil 6.26:1 and
active tabs 5.1–5.6:1. These are sampled results for this outer geometry only.

The corrected `d93e69614` journey passes both UI tests in 267.379 seconds. Independent
review also accepts its three final draft captures: the amount is above the keyboard,
`Repas test` is retained and Ajouter is fully visible after keyboard dismissal.
The close button remains required and is found in the system's separate toolbar;
its accessibility tree contains exactly one matching button. No assertion was relaxed.

The final outcome challenge finds no further demonstrated product blocker for this
internal beta. It does not certify submission, folding or the complete accessibility
matrix. Evidence and the 13-image manifest are linked in [validation.md](validation.md).

## Delivery receipt and scope

The prepared archive copy exports through standard Xcode distribution signing. Actual
app/widget entitlements now match the source capabilities and expected distribution keys;
all three native signatures and actual signing certificates verify. Code, SDK, dependencies,
UUIDs, symbols and metadata remain unchanged. This limited intermediate preparation is not
presented as an officially supported Apple workflow; the final IPA was never patched.

TestFlight readback confirms build `73c0f535-66b2-4cc9-a52f-5b92ec77e45f`, version
`1.11.0 (1)`, is `VALID`, `INTERNAL_ONLY` and `IN_BETA_TESTING` for `Moi`. French
notes match the approved content. There was one upload and no App Review submission.
The temporary archive steps are removed; cleanup does not change the delivered iOS source.

The final signing/provenance challenge found no blocking issue. Implementation and internal
beta delivery are complete; the full Duo configuration/accessibility qualification remains
partial. Full provenance and limits are recorded in [validation.md](validation.md).
