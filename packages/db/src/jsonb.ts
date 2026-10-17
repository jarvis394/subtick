import { customType } from 'drizzle-orm/pg-core'

/**
 * drizzle's own `jsonb()` stringifies values before handing them to the driver, and Bun's SQL
 * then stores that string as a JSON string (`"{...}"`) instead of an object. Bun encodes objects
 * and arrays for jsonb parameters itself, so values go through untouched.
 */
export const jsonb = customType<{ data: unknown; driverData: unknown }>({
  dataType: () => 'jsonb',
  toDriver: (value) => value,
})
