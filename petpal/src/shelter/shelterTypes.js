/** @typedef {'pending'|'approved'|'rejected'|'suspended'} ShelterStatus */

/**
 * @typedef {Object} ShelterProfile
 * @property {string} [id]
 * @property {string} ownerUid
 * @property {'shelter'} accountType
 * @property {string} shelterName
 * @property {string} organizationName
 * @property {string} registrationDetails
 * @property {string} contactPerson
 * @property {string} phoneNumber
 * @property {string} publicEmail
 * @property {string} addressLine
 * @property {string} website
 * @property {Record<string, string>} socialLinks
 * @property {string} description
 * @property {string} logoUrl
 * @property {string} coverPhotoUrl
 * @property {number} lat
 * @property {number} lng
 * @property {string} city
 * @property {ShelterStatus} status
 * @property {import('firebase/firestore').Timestamp} [submittedAt]
 * @property {import('firebase/firestore').Timestamp} [reviewedAt]
 * @property {string} [rejectionNote]
 * @property {string} [reviewNote]
 */

/**
 * @typedef {'available'|'pending'|'adopted'|'foster'|'unavailable'} ShelterAnimalStatus
 */

/**
 * @typedef {Object} ShelterAnimal
 * @property {string} id
 * @property {string} shelterId
 * @property {string} ownerUid
 * @property {string} name
 * @property {string} categoryId
 * @property {string} breed
 * @property {string} age
 * @property {string} sex
 * @property {string} size
 * @property {string} description
 * @property {string} personality
 * @property {string} vaccinationInfo
 * @property {boolean} sterilized
 * @property {string} microchip
 * @property {ShelterAnimalStatus} adoptionStatus
 * @property {string} location
 * @property {Array<{ url: string, storagePath?: string, isPrimary?: boolean }>} photos
 * @property {string} primaryPhotoUrl
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export {};
