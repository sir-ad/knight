export const profileSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["identity", "work_history"],
  "properties": {
    "identity": {
      "type": "object",
      "required": ["name", "email"],
      "properties": {
        "name": { "type": "string" },
        "email": { "type": "string", "format": "email" },
        "phone": { "type": "string" },
        "location": { "type": "string" },
        "linkedin": { "type": "string", "format": "uri" },
        "github": { "type": "string", "format": "uri" },
        "portfolio": { "type": "string", "format": "uri" }
      }
    },
    "work_history": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["company", "title", "start_date"],
        "properties": {
          "company": { "type": "string" },
          "title": { "type": "string" },
          "start_date": { "type": "string", "format": "date" },
          "end_date": { "type": "string", "format": "date" },
          "current": { "type": "boolean" },
          "location": { "type": "string" },
          "description": { "type": "string" },
          "achievements": {
            "type": "array",
            "items": { "type": "string" }
          },
          "skills_used": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    },
    "education": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["degree", "institution"],
        "properties": {
          "degree": { "type": "string" },
          "field": { "type": "string" },
          "institution": { "type": "string" },
          "start_date": { "type": "string", "format": "date" },
          "end_date": { "type": "string", "format": "date" },
          "gpa": { "type": "number" },
          "honors": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    },
    "skills": {
      "type": "object",
      "properties": {
        "technical": {
          "type": "array",
          "items": { "type": "string" }
        },
        "soft": {
          "type": "array",
          "items": { "type": "string" }
        },
        "tools": {
          "type": "array",
          "items": { "type": "string" }
        },
        "languages": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "projects": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "description": { "type": "string" },
          "url": { "type": "string", "format": "uri" },
          "tech_stack": {
            "type": "array",
            "items": { "type": "string" }
          },
          "highlights": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    },
    "certifications": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "issuer": { "type": "string" },
          "date": { "type": "string", "format": "date" },
          "url": { "type": "string", "format": "uri" }
        }
      }
    },
    "meta": {
      "type": "object",
      "properties": {
        "notice_period_days": { "type": "integer" },
        "current_ctc": { "type": "number" },
        "expected_ctc": { "type": "number" },
        "work_mode_preference": {
          "type": "string",
          "enum": ["remote", "hybrid", "onsite", "flexible"]
        },
        "visa_status": { "type": "string" }
      }
    }
  }
}
