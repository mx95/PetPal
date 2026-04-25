// Jest has no `petpal/.env.local`. Provide minimal Firebase public config so
// `src/firebase.js` can load during tests (values are inert; no network is required to render).
if (!process.env.REACT_APP_FIREBASE_API_KEY) {
  process.env.REACT_APP_FIREBASE_API_KEY = 'AIzaSyAbcdef1234567890123456789012345';
  process.env.REACT_APP_FIREBASE_AUTH_DOMAIN = 'demo-test.firebaseapp.com';
  process.env.REACT_APP_FIREBASE_PROJECT_ID = 'demo-test';
  process.env.REACT_APP_FIREBASE_STORAGE_BUCKET = 'demo-test.appspot.com';
  process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID = '123456789000';
  process.env.REACT_APP_FIREBASE_APP_ID = '1:123456789000:web:abcdef0123456789abcd';
}

// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
