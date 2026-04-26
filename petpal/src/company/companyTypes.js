/**
 * @typedef {Object} CompanyApplicationInput
 * @property {string} businessName
 * @property {string} [addressLine]
 * @property {string} [publicEmail]
 * @property {number} lat
 * @property {number} lng
 */

/**
 * @typedef {Object} CompanyProfile
 * @property {string} [id] - from admin list
 * @property {'company'} accountType
 * @property {string} businessName
 * @property {string} [addressLine]
 * @property {string} [publicEmail]
 * @property {number} lat
 * @property {number} lng
 * @property {'pending'|'approved'|'rejected'} status
 * @property {import('firebase/firestore').Timestamp} [submittedAt]
 * @property {import('firebase/firestore').Timestamp} [reviewedAt]
 * @property {string} [rejectionNote]
 * @property {string} [reviewNote]
 */

export {};
