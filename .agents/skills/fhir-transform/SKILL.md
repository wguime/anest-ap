---
name: fhir-transform
description: Transform healthcare data to/from FHIR R4 format with validation. Use when integrating with EHR systems, building FHIR APIs, converting legacy data, or ensuring FHIR compliance.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# FHIR Data Transformer & Validator

Transform healthcare data to/from FHIR R4 (Fast Healthcare Interoperability Resources) format with comprehensive validation.

## FHIR Overview

**FHIR R4** is the international standard for electronic health information exchange, mandated by:
- US: ONC 21st Century Cures Act
- International: HL7 International standard

**Key Concepts:**
- **Resources:** Discrete healthcare data elements (Patient, Observation, Condition, etc.)
- **Bundle:** Collection of resources
- **RESTful:** Uses standard HTTP methods (GET, POST, PUT, DELETE)
- **JSON/XML:** Both formats supported (JSON preferred)

## Core FHIR Resources

### 1. Patient Resource
Demographic and administrative information about a person.

**Required Elements:**
- `resourceType`: "Patient"
- `id`: Unique identifier
- At least one of: name, telecom, address, birthDate, gender

**Example:**
```json
{
  "resourceType": "Patient",
  "id": "patient-123",
  "identifier": [{
    "system": "http://hospital.example.org/mrn",
    "value": "MRN123456"
  }],
  "active": true,
  "name": [{
    "use": "official",
    "family": "Smith",
    "given": ["John", "Michael"]
  }],
  "telecom": [{
    "system": "phone",
    "value": "555-1234",
    "use": "home"
  }],
  "gender": "male",
  "birthDate": "1970-05-15",
  "address": [{
    "use": "home",
    "line": ["123 Main St"],
    "city": "Boston",
    "state": "MA",
    "postalCode": "02139",
    "country": "US"
  }],
  "maritalStatus": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus",
      "code": "M",
      "display": "Married"
    }]
  }
}
```

### 2. Observation Resource
Measurements and assertions about a patient (vitals, labs, etc.).

**Required Elements:**
- `resourceType`: "Observation"
- `status`: registered | preliminary | final | amended
- `code`: What was observed (LOINC code)
- `subject`: Reference to Patient

**Example - Lab Result:**
```json
{
  "resourceType": "Observation",
  "id": "obs-glucose-001",
  "status": "final",
  "category": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/observation-category",
      "code": "laboratory",
      "display": "Laboratory"
    }]
  }],
  "code": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "2339-0",
      "display": "Glucose [Mass/volume] in Blood"
    }]
  },
  "subject": {
    "reference": "Patient/patient-123"
  },
  "effectiveDateTime": "2024-03-06T09:30:00Z",
  "valueQuantity": {
    "value": 95,
    "unit": "mg/dL",
    "system": "http://unitsofmeasure.org",
    "code": "mg/dL"
  },
  "referenceRange": [{
    "low": {
      "value": 70,
      "unit": "mg/dL"
    },
    "high": {
      "value": 100,
      "unit": "mg/dL"
    }
  }]
}
```

**Example - Vital Signs:**
```json
{
  "resourceType": "Observation",
  "id": "obs-bp-001",
  "status": "final",
  "category": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/observation-category",
      "code": "vital-signs"
    }]
  }],
  "code": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "85354-9",
      "display": "Blood pressure panel"
    }]
  },
  "subject": {
    "reference": "Patient/patient-123"
  },
  "effectiveDateTime": "2024-03-06T10:00:00Z",
  "component": [{
    "code": {
      "coding": [{
        "system": "http://loinc.org",
        "code": "8480-6",
        "display": "Systolic blood pressure"
      }]
    },
    "valueQuantity": {
      "value": 120,
      "unit": "mmHg",
      "system": "http://unitsofmeasure.org",
      "code": "mm[Hg]"
    }
  }, {
    "code": {
      "coding": [{
        "system": "http://loinc.org",
        "code": "8462-4",
        "display": "Diastolic blood pressure"
      }]
    },
    "valueQuantity": {
      "value": 80,
      "unit": "mmHg",
      "system": "http://unitsofmeasure.org",
      "code": "mm[Hg]"
    }
  }]
}
```

### 3. Condition Resource
Clinical conditions, problems, diagnoses.

**Required Elements:**
- `resourceType`: "Condition"
- `clinicalStatus`: active | inactive | resolved
- `code`: Condition code (ICD-10, SNOMED)
- `subject`: Reference to Patient

**Example:**
```json
{
  "resourceType": "Condition",
  "id": "condition-diabetes-001",
  "clinicalStatus": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
      "code": "active"
    }]
  },
  "verificationStatus": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
      "code": "confirmed"
    }]
  },
  "category": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/condition-category",
      "code": "encounter-diagnosis",
      "display": "Encounter Diagnosis"
    }]
  }],
  "severity": {
    "coding": [{
      "system": "http://snomed.info/sct",
      "code": "24484000",
      "display": "Severe"
    }]
  },
  "code": {
    "coding": [{
      "system": "http://hl7.org/fhir/sid/icd-10-cm",
      "code": "E11.9",
      "display": "Type 2 diabetes mellitus without complications"
    }, {
      "system": "http://snomed.info/sct",
      "code": "44054006",
      "display": "Diabetes mellitus type 2"
    }]
  },
  "subject": {
    "reference": "Patient/patient-123"
  },
  "onsetDateTime": "2020-03-15",
  "recordedDate": "2020-03-15"
}
```

### 4. MedicationRequest Resource
Prescription or medication order.

**Example:**
```json
{
  "resourceType": "MedicationRequest",
  "id": "med-request-001",
  "status": "active",
  "intent": "order",
  "medicationCodeableConcept": {
    "coding": [{
      "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
      "code": "1361574",
      "display": "metFORMIN hydrochloride 500 MG Oral Tablet"
    }],
    "text": "Metformin 500mg tablet"
  },
  "subject": {
    "reference": "Patient/patient-123"
  },
  "authoredOn": "2024-03-06",
  "requester": {
    "reference": "Practitioner/dr-jones"
  },
  "dosageInstruction": [{
    "text": "Take 1 tablet by mouth twice daily with meals",
    "timing": {
      "repeat": {
        "frequency": 2,
        "period": 1,
        "periodUnit": "d"
      }
    },
    "route": {
      "coding": [{
        "system": "http://snomed.info/sct",
        "code": "26643006",
        "display": "Oral route"
      }]
    },
    "doseAndRate": [{
      "doseQuantity": {
        "value": 1,
        "unit": "tablet"
      }
    }]
  }]
}
```

### 5. Encounter Resource
Interaction between patient and healthcare provider.

**Example:**
```json
{
  "resourceType": "Encounter",
  "id": "encounter-001",
  "status": "finished",
  "class": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    "code": "IMP",
    "display": "inpatient encounter"
  },
  "type": [{
    "coding": [{
      "system": "http://snomed.info/sct",
      "code": "308646001",
      "display": "Hospital admission"
    }]
  }],
  "subject": {
    "reference": "Patient/patient-123"
  },
  "participant": [{
    "type": [{
      "coding": [{
        "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
        "code": "ATND",
        "display": "attender"
      }]
    }],
    "individual": {
      "reference": "Practitioner/dr-jones"
    }
  }],
  "period": {
    "start": "2024-03-01T08:00:00Z",
    "end": "2024-03-05T16:00:00Z"
  },
  "reasonCode": [{
    "coding": [{
      "system": "http://hl7.org/fhir/sid/icd-10-cm",
      "code": "I21.9",
      "display": "Acute myocardial infarction"
    }]
  }],
  "hospitalization": {
    "admitSource": {
      "coding": [{
        "system": "http://terminology.hl7.org/CodeSystem/admit-source",
        "code": "emd",
        "display": "From accident/emergency department"
      }]
    },
    "dischargeDisposition": {
      "coding": [{
        "system": "http://terminology.hl7.org/CodeSystem/discharge-disposition",
        "code": "home",
        "display": "Home"
      }]
    }
  }
}
```

### 6. Procedure Resource
Action performed on or for a patient.

**Example:**
```json
{
  "resourceType": "Procedure",
  "id": "procedure-001",
  "status": "completed",
  "code": {
    "coding": [{
      "system": "http://www.ama-assn.org/go/cpt",
      "code": "99213",
      "display": "Office visit, established patient"
    }]
  },
  "subject": {
    "reference": "Patient/patient-123"
  },
  "performedDateTime": "2024-03-06T14:00:00Z",
  "performer": [{
    "actor": {
      "reference": "Practitioner/dr-jones"
    }
  }]
}
```

### 7. AllergyIntolerance Resource
Allergies and intolerances.

**Example:**
```json
{
  "resourceType": "AllergyIntolerance",
  "id": "allergy-001",
  "clinicalStatus": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
      "code": "active"
    }]
  },
  "verificationStatus": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
      "code": "confirmed"
    }]
  },
  "type": "allergy",
  "category": ["medication"],
  "criticality": "high",
  "code": {
    "coding": [{
      "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
      "code": "7980",
      "display": "Penicillin"
    }]
  },
  "patient": {
    "reference": "Patient/patient-123"
  },
  "reaction": [{
    "manifestation": [{
      "coding": [{
        "system": "http://snomed.info/sct",
        "code": "271807003",
        "display": "Skin rash"
      }]
    }],
    "severity": "moderate"
  }]
}
```

### 8. DiagnosticReport Resource
Findings from diagnostic procedures.

**Example:**
```json
{
  "resourceType": "DiagnosticReport",
  "id": "report-001",
  "status": "final",
  "category": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
      "code": "LAB",
      "display": "Laboratory"
    }]
  }],
  "code": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "58410-2",
      "display": "Complete blood count (hemogram) panel"
    }]
  },
  "subject": {
    "reference": "Patient/patient-123"
  },
  "effectiveDateTime": "2024-03-06T09:30:00Z",
  "issued": "2024-03-06T11:00:00Z",
  "result": [
    {"reference": "Observation/obs-hemoglobin-001"},
    {"reference": "Observation/obs-wbc-001"},
    {"reference": "Observation/obs-platelets-001"}
  ]
}
```

## FHIR Bundle
Collection of resources (for batch operations, search results, etc.).

**Types:**
- `document`: Immutable collection
- `message`: Message
- `transaction`: Atomic update
- `transaction-response`: Response to transaction
- `batch`: Non-atomic update
- `batch-response`: Response to batch
- `history`: Version history
- `searchset`: Search results
- `collection`: General collection

**Example:**
```json
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [{
    "fullUrl": "urn:uuid:patient-001",
    "resource": {
      "resourceType": "Patient",
      "name": [{"family": "Smith", "given": ["John"]}]
    },
    "request": {
      "method": "POST",
      "url": "Patient"
    }
  }, {
    "fullUrl": "urn:uuid:obs-001",
    "resource": {
      "resourceType": "Observation",
      "status": "final",
      "code": {"coding": [{"system": "http://loinc.org", "code": "2339-0"}]},
      "subject": {"reference": "urn:uuid:patient-001"},
      "valueQuantity": {"value": 95, "unit": "mg/dL"}
    },
    "request": {
      "method": "POST",
      "url": "Observation"
    }
  }]
}
```

## Transformation Tasks

### Task 1: CSV to FHIR

**Input:** CSV with patient data
```csv
MRN,FirstName,LastName,DOB,Gender,Phone,City,State,ZIP
MRN001,John,Smith,1970-05-15,M,555-1234,Boston,MA,02139
MRN002,Jane,Doe,1985-08-22,F,555-5678,Cambridge,MA,02140
```

**Output:** FHIR Bundle with Patient resources

**Transformation Steps:**
1. Parse CSV
2. Map each row to Patient resource
3. Handle data type conversions
4. Wrap in Bundle

### Task 2: HL7 v2 to FHIR

**Input:** HL7 v2 ADT message
```
MSH|^~\&|SendingApp|SendingFac|ReceivingApp|ReceivingFac|20240306090000||ADT^A01|MSG001|P|2.5
PID|1||MRN123456^^^Hospital^MR||Smith^John^M||19700515|M|||123 Main St^^Boston^MA^02139||555-1234|||M|
PV1|1|I|Ward^Room^Bed|
```

**Output:** FHIR Bundle with Patient and Encounter resources

**Transformation Map:**
- MSH → Bundle/MessageHeader
- PID → Patient resource
- PV1 → Encounter resource

### Task 3: Legacy JSON to FHIR

**Input:** Custom JSON format
```json
{
  "patient_id": "12345",
  "name": "John Smith",
  "dob": "05/15/1970",
  "diagnosis": "E11.9",
  "glucose": 95
}
```

**Output:** FHIR Bundle with Patient, Condition, Observation

### Task 4: FHIR to CSV (Flattening)

**Input:** FHIR Bundle with complex nested resources

**Output:** Flat CSV for analytics/reporting

**Challenges:**
- One-to-many relationships (patient → multiple conditions)
- Nested structures (address, name components)
- Code systems (extract display values)

### Task 5: FHIR Validation

Validate existing FHIR resources against:
- FHIR R4 specification
- US Core profiles
- Custom implementation guides
- Required fields
- Data types
- Code system bindings
- Reference integrity

## Validation Rules

### Resource-Level Validation

**For all resources:**
- ✅ `resourceType` present and valid
- ✅ `id` format valid (alphanumeric, -, _, max 64 chars)
- ✅ Required elements present
- ✅ Data types correct
- ✅ References valid format

**Patient-specific:**
- ✅ At least one identifier OR name OR telecom OR birthDate
- ✅ `gender` must be: male | female | other | unknown
- ✅ `birthDate` format: YYYY, YYYY-MM, or YYYY-MM-DD
- ✅ Telecom `system`: phone | fax | email | pager | url | sms | other
- ✅ Address components valid

**Observation-specific:**
- ✅ `status` required: registered | preliminary | final | amended | corrected | cancelled | entered-in-error | unknown
- ✅ `code` required with valid coding
- ✅ `subject` reference required
- ✅ Must have value[x] OR component OR dataAbsentReason
- ✅ If value, must match expected type (valueQuantity, valueString, etc.)

**Condition-specific:**
- ✅ `clinicalStatus` OR `verificationStatus` = "entered-in-error"
- ✅ `code` required
- ✅ `subject` required

### Code System Validation

**Common code systems:**
- **LOINC:** Lab and clinical observations
  - Format: 5-6 digit numeric with optional -X
  - System: `http://loinc.org`
- **SNOMED CT:** Clinical terminology
  - Format: Numeric codes
  - System: `http://snomed.info/sct`
- **ICD-10-CM:** Diagnoses
  - Format: Letter + 2 digits + optional .XX
  - System: `http://hl7.org/fhir/sid/icd-10-cm`
- **RxNorm:** Medications
  - Format: Numeric codes
  - System: `http://www.nlm.nih.gov/research/umls/rxnorm`
- **CPT:** Procedures
  - Format: 5-digit numeric or 4-digit + letter
  - System: `http://www.ama-assn.org/go/cpt`

### Reference Validation

**Reference formats:**
- Literal: `Patient/123`
- Relative: `Patient/123`
- Absolute: `https://server.com/fhir/Patient/123`
- UUID: `urn:uuid:12345678-1234-1234-1234-123456789012`

**Check:**
- ✅ Referenced resource exists (within Bundle)
- ✅ Referenced resource type matches
- ✅ No circular references
- ✅ Required references present

### Data Type Validation

**Common FHIR data types:**
- **string:** UTF-8, max 1MB
- **integer:** 32-bit signed
- **decimal:** Rational number
- **boolean:** true | false
- **instant:** YYYY-MM-DDThh:mm:ss.sss+zz:zz
- **date:** YYYY, YYYY-MM, YYYY-MM-DD
- **dateTime:** YYYY-MM-DDThh:mm:ss+zz:zz
- **time:** hh:mm:ss
- **code:** String with no whitespace
- **uri:** Uniform Resource Identifier
- **Coding:** {system, code, display}
- **CodeableConcept:** {coding[], text}
- **Quantity:** {value, unit, system, code}
- **Reference:** {reference, display}

## Transformation Code Examples

### Python: CSV to FHIR
```python
import pandas as pd
import json
from datetime import datetime

def csv_to_fhir_bundle(csv_file):
    """Convert CSV to FHIR Bundle"""
    df = pd.read_csv(csv_file)

    bundle = {
        "resourceType": "Bundle",
        "type": "collection",
        "entry": []
    }

    for idx, row in df.iterrows():
        patient = {
            "resourceType": "Patient",
            "id": f"patient-{idx}",
            "identifier": [{
                "system": "http://hospital.example.org/mrn",
                "value": row['MRN']
            }],
            "name": [{
                "use": "official",
                "family": row['LastName'],
                "given": [row['FirstName']]
            }],
            "gender": row['Gender'].lower(),
            "birthDate": row['DOB'],  # Ensure YYYY-MM-DD format
            "telecom": [{
                "system": "phone",
                "value": row['Phone'],
                "use": "home"
            }],
            "address": [{
                "use": "home",
                "city": row['City'],
                "state": row['State'],
                "postalCode": row['ZIP'],
                "country": "US"
            }]
        }

        bundle["entry"].append({
            "fullUrl": f"urn:uuid:patient-{idx}",
            "resource": patient
        })

    return bundle

# Save to file
with open('patients_fhir.json', 'w') as f:
    json.dump(bundle, f, indent=2)
```

### Python: FHIR Validation
```python
def validate_patient(patient):
    """Validate Patient resource"""
    errors = []
    warnings = []

    # Required: resourceType
    if patient.get('resourceType') != 'Patient':
        errors.append("Invalid resourceType")

    # Must have at least one identifier, name, telecom, or birthDate
    if not any([patient.get('identifier'), patient.get('name'),
                patient.get('telecom'), patient.get('birthDate')]):
        errors.append("Patient must have at least one of: identifier, name, telecom, birthDate")

    # Validate gender
    if 'gender' in patient:
        valid_genders = ['male', 'female', 'other', 'unknown']
        if patient['gender'] not in valid_genders:
            errors.append(f"Invalid gender: {patient['gender']}")

    # Validate birthDate format
    if 'birthDate' in patient:
        try:
            datetime.strptime(patient['birthDate'], '%Y-%m-%d')
        except ValueError:
            errors.append(f"Invalid birthDate format: {patient['birthDate']}")

    # Validate identifier structure
    if 'identifier' in patient:
        for idx, identifier in enumerate(patient['identifier']):
            if 'value' not in identifier:
                errors.append(f"Identifier[{idx}] missing required 'value'")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings
    }
```

### Python: FHIR to CSV
```python
def fhir_bundle_to_csv(bundle):
    """Flatten FHIR Bundle to CSV"""
    patients = []

    for entry in bundle.get('entry', []):
        resource = entry.get('resource', {})
        if resource.get('resourceType') != 'Patient':
            continue

        # Extract and flatten
        patient_data = {
            'id': resource.get('id'),
            'mrn': '',
            'first_name': '',
            'last_name': '',
            'gender': resource.get('gender', ''),
            'birth_date': resource.get('birthDate', ''),
            'phone': '',
            'email': '',
            'city': '',
            'state': '',
            'zip': ''
        }

        # Extract MRN from identifiers
        for identifier in resource.get('identifier', []):
            if 'mrn' in identifier.get('system', '').lower():
                patient_data['mrn'] = identifier.get('value', '')
                break

        # Extract name
        if resource.get('name'):
            name = resource['name'][0]
            patient_data['family_name'] = name.get('family', '')
            if name.get('given'):
                patient_data['first_name'] = name['given'][0]

        # Extract telecom
        for telecom in resource.get('telecom', []):
            system = telecom.get('system')
            if system == 'phone':
                patient_data['phone'] = telecom.get('value', '')
            elif system == 'email':
                patient_data['email'] = telecom.get('value', '')

        # Extract address
        if resource.get('address'):
            address = resource['address'][0]
            patient_data['city'] = address.get('city', '')
            patient_data['state'] = address.get('state', '')
            patient_data['zip'] = address.get('postalCode', '')

        patients.append(patient_data)

    # Convert to DataFrame and save
    df = pd.DataFrame(patients)
    df.to_csv('patients_flattened.csv', index=False)
    return df
```

## Process Flow

### When User Requests Transformation:

1. **Identify Input Format**
   - Scan files to detect format (CSV, JSON, HL7, XML, etc.)
   - Determine source schema

2. **Ask User for Details**
   ```
   I found CSV files with patient data.

   What would you like to do?
   1. Convert to FHIR Bundle
   2. Validate existing FHIR resources
   3. Convert FHIR to CSV (flatten)
   4. Transform custom format to FHIR
   5. Generate FHIR API endpoint code

   Choose (1-5):
   ```

3. **Clarify Mapping**
   If converting TO FHIR, ask:
   ```
   I need to map your fields to FHIR elements:

   - "patient_id" → Patient.identifier.value?
   - "name" → Patient.name.text OR separate family/given?
   - "dob" → Patient.birthDate? (will convert to YYYY-MM-DD)
   - "diagnosis" → Condition.code.coding.code?

   Confirm or provide custom mapping?
   ```

4. **Execute Transformation**
   - Generate transformation code
   - Apply transformations
   - Handle errors/edge cases

5. **Validate Output**
   - Run FHIR validation
   - Check for errors
   - Report issues

6. **Generate Artifacts**
   - Transformed data files
   - Validation report
   - Transformation code (reusable)
   - Documentation

## Advanced Features

### Feature 1: US Core Profile Validation
Validate against US Core FHIR profiles (required for US healthcare systems):
- Must Support elements
- Required binding strengths
- US-specific constraints

### Feature 2: SMART on FHIR Integration
Generate code for SMART on FHIR apps:
- OAuth 2.0 authentication
- Patient context
- Scopes (patient/*.read, user/*.*)
- Launch sequences

### Feature 3: FHIR Search Implementation
Generate search endpoint code:
- Search parameters
- Modifiers (_exact, _contains)
- Chaining (Patient?general-practitioner.name=Smith)
- Reverse chaining (_has)
- Composite searches

### Feature 4: FHIR Bulk Data Export
Implement Bulk Data Export (for population health):
- $export operation
- NDJSON format
- Asynchronous pattern
- Patient-level, Group-level, System-level

### Feature 5: Terminology Services
Integrate with terminology servers:
- ValueSet expansion
- CodeSystem lookup
- Concept map translation
- Validation against value sets

## Output Format

```markdown
# FHIR Transformation Report

## Summary
- **Input Format:** CSV
- **Output Format:** FHIR R4 JSON Bundle
- **Records Processed:** 156
- **Resources Generated:** 156 Patients, 312 Observations, 89 Conditions
- **Validation Status:** ✅ PASSED

## Transformation Details

### Source Data
- **File:** patients.csv
- **Rows:** 156
- **Columns:** 12

### Mapping Applied
| Source Field | FHIR Element | Transformation |
|--------------|--------------|----------------|
| MRN | Patient.identifier.value | Direct mapping |
| FirstName | Patient.name.given[0] | Direct mapping |
| LastName | Patient.name.family | Direct mapping |
| DOB | Patient.birthDate | Format: MM/DD/YYYY → YYYY-MM-DD |
| Gender | Patient.gender | M→male, F→female |
| Phone | Patient.telecom[0].value | Added system="phone" |
| DiagnosisCode | Condition.code.coding.code | ICD-10-CM system |

### Generated Files
- ✅ `patients_fhir_bundle.json` (156 Patient resources)
- ✅ `conditions_fhir_bundle.json` (89 Condition resources)
- ✅ `observations_fhir_bundle.json` (312 Observation resources)

## Validation Results

### Patient Resources: ✅ PASSED (156/156)
- All required elements present
- Valid gender codes
- Valid birthDate formats
- Valid identifier systems
- No validation errors

### Condition Resources: ⚠️ WARNINGS (89/89)
- 12 conditions using unspecified ICD-10 codes (*.9)
- All conditions valid but consider more specific codes

### Observation Resources: ✅ PASSED (312/312)
- Valid LOINC codes
- Valid units (UCUM)
- Valid value ranges
- Proper subject references

## Code Generated

Python transformation script saved to: `transform_csv_to_fhir.py`

Usage:
```bash
python transform_csv_to_fhir.py patients.csv --output patients_fhir.json
```

## Next Steps

1. ✅ Review generated FHIR resources
2. ⚠️ Address 12 unspecified diagnosis codes
3. ✅ Upload to FHIR server OR
4. ✅ Use for testing/development OR
5. ✅ Export to different format

Would you like me to:
- Upload to a FHIR server?
- Generate API endpoint code?
- Convert to another format?
- Validate against US Core profiles?
```

## When Complete

Provide:
1. Summary of transformation
2. Generated FHIR resources (files or inline)
3. Validation report
4. Reusable transformation code
5. Documentation of mappings
6. Next steps and recommendations

Offer to:
- Generate FHIR API server code
- Create FHIR client code
- Validate against specific profiles
- Convert to other formats
- Upload to FHIR test server
