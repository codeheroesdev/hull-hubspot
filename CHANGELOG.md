# Changelog

## v0.2.5
- make sure the process exit after an `uncaughtException`

## v0.2.4
- [maintenance] update dependencies
- [UI] design updates
- [tooling] include `npm run ngrok` command

## v0.2.3
- [hotfix] treat the incoming field as an array only when it's enumeration checkbox, other enumeration - select, radio is treated as a signle value field

## v0.2.2
- [bugfix] move `ship:update` handler to background job so it doesn't interfere
with refresh token operation (which triggers the update event) 

## v0.2.1
- [bugfix] handle the datetime field type
- [maintenance] add automatic queue cleaning
- [maintenance] add more logging about token problems

## v0.2.0
- [feature] enable custom outgoing attributes mapping (can map both to new and existing fields on Hubspot). In case of new field a prefixed `hull_` property is created.
- [feature] load list of properties to settings select inputs
- [feature] cast arrays for incoming data to save it as array in Hull
- [bugfix] fix handling of different values, until now trait with value `false` won't be sent
- [maintenance] logging level support
- [maintenance] introduce modules from utils library
- [maintenance] improve logging and metrics

## v0.1.0
- setIfNull for `first_name` and `last_name`
- join outgoing arrays with ";"
