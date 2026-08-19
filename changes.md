# Crew Status 2 release notes

## v2.2.0

- Roster hours now remain aligned with the worksheet's fixed 24 slots on both UK daylight-saving changeovers.
- Refreshes now run one at a time. Repeated triggers are collapsed into one latest pending refresh rather than starting competing requests.
- The Settings version now comes directly from `package.json`.
- Added regression tests for the March and October clock changes, request cancellation, refresh queuing, and displayed application version.

## v2.1.0

- Added offline application-shell and validated roster caching, with an accurate offline status banner.
- Added Wednesday-to-Tuesday worksheet validation and delayed next-week availability until Tuesday.
- Added the Station Board seven-day forecast with two rows of 12 hours, hour-ending labels, and visible crew counts.
- Grouped active crew names by role while allowing every summary card to open the complete on-call list.
- Added a Safari-safe current-hour border and changed the personal availability pulse to a two-second cycle.
