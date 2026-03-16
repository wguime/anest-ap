# Firestore Staff Collection Documentation

## Overview

The `staff` collection stores the work schedules for staff members across hospital and consultório (clinic) locations. This enables the application to display daily staff schedules on the HomePage and in the Centro de Gestão.

## Collection Structure

**Collection Name:** `staff`

**Document ID:** User-generated (unique identifier for each staff member)

## Document Schema

```typescript
{
  nome: string,           // Staff member's full name
  tipo: string,           // Type: "hospital" | "consultorio"
  dias: {                 // Weekly schedule object
    segunda?: Schedule,
    terca?: Schedule,
    quarta?: Schedule,
    quinta?: Schedule,
    sexta?: Schedule,
    sabado?: Schedule,
    domingo?: Schedule
  },
  ativo: boolean,         // Whether the staff member is active
  createdAt: Timestamp,   // Document creation timestamp
  updatedAt: Timestamp    // Last update timestamp
}

interface Schedule {
  turno: string,    // Shift: "manhã" | "tarde" | "plantão 24h"
  local: string,    // Location: "Hospital A" | "Hospital B" | "Consultório" | etc.
  ativo: boolean    // Whether this specific day/shift is active
}
```

## Field Descriptions

### Root Fields

- **`nome`** (string, required)
  - Staff member's full name
  - Example: `"Dr. João Silva"`

- **`tipo`** (string, required)
  - Staff member type/category
  - Valid values: `"hospital"`, `"consultorio"`
  - Used to filter schedules by location type

- **`dias`** (object, required)
  - Weekly schedule object
  - Keys are day names in Portuguese (without accents): `segunda`, `terca`, `quarta`, `quinta`, `sexta`, `sabado`, `domingo`
  - Each day can have a Schedule object or be omitted if the staff member doesn't work that day

- **`ativo`** (boolean, required)
  - Whether the staff member is currently active
  - Inactive staff members should not be displayed in schedules
  - Default: `true`

- **`createdAt`** (Timestamp, auto-generated)
  - Document creation timestamp
  - Should be set using `firebase.firestore.FieldValue.serverTimestamp()`

- **`updatedAt`** (Timestamp, auto-generated)
  - Last modification timestamp
  - Should be updated using `firebase.firestore.FieldValue.serverTimestamp()` on each edit

### Schedule Object Fields

Each day in the `dias` object can have:

- **`turno`** (string, required)
  - Shift/period of work
  - Valid values: `"manhã"`, `"tarde"`, `"plantão 24h"`

- **`local`** (string, required)
  - Specific location where the staff member works
  - Examples: `"Hospital Municipal"`, `"Hospital Regional"`, `"Consultório Centro"`, `"Consultório Zona Sul"`

- **`ativo`** (boolean, required)
  - Whether this specific day/shift is active
  - Allows temporarily disabling a specific day without removing the entry
  - Default: `true`

## Sample Documents

### Hospital Staff Example

```json
{
  "nome": "Dr. João Silva",
  "tipo": "hospital",
  "dias": {
    "segunda": {
      "turno": "manhã",
      "local": "Hospital Municipal",
      "ativo": true
    },
    "terca": {
      "turno": "tarde",
      "local": "Hospital Regional",
      "ativo": true
    },
    "quarta": {
      "turno": "manhã",
      "local": "Hospital Municipal",
      "ativo": true
    },
    "quinta": {
      "turno": "plantão 24h",
      "local": "Hospital Municipal",
      "ativo": true
    },
    "sexta": {
      "turno": "manhã",
      "local": "Hospital Regional",
      "ativo": true
    }
  },
  "ativo": true,
  "createdAt": "2026-02-15T10:00:00Z",
  "updatedAt": "2026-02-15T10:00:00Z"
}
```

### Consultório Staff Example

```json
{
  "nome": "Dra. Maria Santos",
  "tipo": "consultorio",
  "dias": {
    "segunda": {
      "turno": "tarde",
      "local": "Consultório Centro",
      "ativo": true
    },
    "terca": {
      "turno": "tarde",
      "local": "Consultório Centro",
      "ativo": true
    },
    "quarta": {
      "turno": "tarde",
      "local": "Consultório Zona Sul",
      "ativo": true
    },
    "sexta": {
      "turno": "manhã",
      "local": "Consultório Centro",
      "ativo": true
    }
  },
  "ativo": true,
  "createdAt": "2026-02-15T10:00:00Z",
  "updatedAt": "2026-02-15T10:00:00Z"
}
```

### 24-Hour Shift Example

```json
{
  "nome": "Dr. Pedro Costa",
  "tipo": "hospital",
  "dias": {
    "sabado": {
      "turno": "plantão 24h",
      "local": "Hospital Municipal",
      "ativo": true
    },
    "domingo": {
      "turno": "plantão 24h",
      "local": "Hospital Municipal",
      "ativo": true
    }
  },
  "ativo": true,
  "createdAt": "2026-02-15T10:00:00Z",
  "updatedAt": "2026-02-15T10:00:00Z"
}
```

## Firestore Security Rules

Add the following rules to your `firestore.rules` file:

```javascript
match /staff/{staffId} {
  // All authenticated users can read staff schedules
  allow read: if request.auth != null;

  // Only admins can create, update, or delete staff schedules
  allow create, update, delete: if request.auth != null &&
    get(/databases/$(database)/documents/userProfiles/$(request.auth.uid)).data.isAdmin == true;
}
```

## Querying Examples

### Get All Active Hospital Staff

```javascript
const hospitalStaff = await firebase.firestore()
  .collection('staff')
  .where('tipo', '==', 'hospital')
  .where('ativo', '==', true)
  .get();
```

### Get All Active Consultório Staff

```javascript
const consultorioStaff = await firebase.firestore()
  .collection('staff')
  .where('tipo', '==', 'consultorio')
  .where('ativo', '==', true)
  .get();
```

### Get Staff Working on a Specific Day

```javascript
// Get all staff who work on Monday
const mondayStaff = await firebase.firestore()
  .collection('staff')
  .where('ativo', '==', true)
  .get();

// Filter in client code for staff with Monday schedule
const workingMonday = mondayStaff.docs.filter(doc => {
  const data = doc.data();
  return data.dias?.segunda?.ativo === true;
});
```

## Integration with useStaff Hook

The `useStaff` hook in `/Users/guilherme/Documents/IA/Qmentum/versão-2.0/web/src/hooks/useStaff.js` provides helper methods:

```javascript
const {
  staff,                    // All staff data
  staffLoading,             // Loading state
  staffUsandoMock,          // Whether using mock data
  canEdit,                  // Whether current user can edit
  getHospitalStaffByDay,    // Get hospital staff for a specific day
  getConsultorioByDay,      // Get consultório staff for a specific day
} = useStaff();

// Get hospital staff working on Monday
const mondayHospital = getHospitalStaffByDay('segunda');

// Get consultório staff working on Friday
const fridayConsultorio = getConsultorioByDay('sexta');
```

## Notes

1. **Day Names:** Use Portuguese day names without accents: `segunda`, `terca`, `quarta`, `quinta`, `sexta`, `sabado`, `domingo`

2. **Shifts:** The three valid shift types are:
   - `"manhã"` - Morning shift
   - `"tarde"` - Afternoon shift
   - `"plantão 24h"` - 24-hour on-call shift

3. **Multiple Locations:** A staff member can work at different locations on different days by varying the `local` field

4. **Inactive Days:** To temporarily disable a specific day without deleting it, set `dias.{day}.ativo` to `false`

5. **Inactive Staff:** To hide a staff member entirely, set the root `ativo` field to `false`

6. **Mock Data:** The application falls back to mock data defined in `src/types/documents.js` when the Firestore collection is empty or unavailable

## Migration from Mock Data

To migrate from mock data to Firestore:

1. Create the `staff` collection in Firestore
2. Import mock data from `src/types/documents.js` using the schema above
3. Set `USE_MOCK = false` in `src/types/documents.js` or implement automatic detection
4. Verify data displays correctly in HomePage and Centro de Gestão

## Future Enhancements

Potential improvements to consider:

- Add `especialidade` field for staff specialty
- Add `telefone` and `email` contact fields
- Add `cor` field for custom color coding in UI
- Create `staff_historico` subcollection for schedule change history
- Add `observacoes` field for notes about specific shifts
- Implement recurring schedules (e.g., every other week)
