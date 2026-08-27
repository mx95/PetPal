/** @typedef {'active'|'found'|'reported'|'archived'} LostPetStatus */

/**
 * @typedef {Object} LostPetPhoto
 * @property {string} url
 * @property {string} [storagePath]
 * @property {boolean} [isPrimary]
 */

/**
 * @typedef {Object} LostPetAlert
 * @property {string} id
 * @property {string} ownerUid
 * @property {string} petId
 * @property {string} petName
 * @property {string} categoryId
 * @property {string} breed
 * @property {string} description
 * @property {string} identifyingMarks
 * @property {string} lastSeenText
 * @property {string} lastSeenAt
 * @property {number|null} lastSeenLat
 * @property {number|null} lastSeenLng
 * @property {string} reward
 * @property {string} contactPhone
 * @property {string} additionalInfo
 * @property {LostPetPhoto[]} photos
 * @property {string} primaryPhotoUrl
 * @property {LostPetStatus} status
 * @property {number} reportCount
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} foundAt
 */

/**
 * @typedef {Object} LostPetAlertInput
 * @property {string} petId
 * @property {string} petName
 * @property {string} categoryId
 * @property {string} [breed]
 * @property {string} description
 * @property {string} [identifyingMarks]
 * @property {string} lastSeenText
 * @property {string} [lastSeenAt]
 * @property {number|null} [lastSeenLat]
 * @property {number|null} [lastSeenLng]
 * @property {string} [reward]
 * @property {string} contactPhone
 * @property {string} [additionalInfo]
 * @property {LostPetPhoto[]} photos
 */

export {};
