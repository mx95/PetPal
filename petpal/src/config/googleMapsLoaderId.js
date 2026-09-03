/**
 * Single id + libraries for all `useJsApiLoader` / LoadScript in the app.
 * Different ids or libraries arrays make @react-google-maps/api throw
 * "Loader must not be called again with different options".
 *
 * Keep `GOOGLE_MAPS_LIBRARIES` as a stable module-level constant — never pass
 * a fresh `['places']` array literal from inside a component.
 */
export const GOOGLE_MAPS_LOADER_ID = 'petpal-google-maps';

/** @type {import('@react-google-maps/api').Libraries} */
export const GOOGLE_MAPS_LIBRARIES = ['places'];
