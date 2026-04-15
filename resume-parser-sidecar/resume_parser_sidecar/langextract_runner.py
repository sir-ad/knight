from __future__ import annotations

from typing import Any

import langextract as lx
from langextract.data import ExampleData, Extraction

from .models import ParseDiagnostic, ProviderConfig
from .providers import build_langextract_model

PROMPT_DESCRIPTION = """
Extract resume data for a job-application profile.

Allowed extraction classes:
- identity_name
- identity_email
- identity_phone
- identity_location
- identity_linkedin
- identity_github
- identity_portfolio
- work_experience
- education
- skill_technical
- skill_soft
- skill_tool
- skill_language
- project
- certification
- meta_notice_period_days
- meta_current_ctc
- meta_expected_ctc
- meta_work_mode_preference
- meta_visa_status

Rules:
- Use the exact surface text from the resume as extraction_text.
- For work_experience, use attributes: company, title, start_date, end_date, current, location, description, achievements, skills_used.
- For education, use attributes: degree, field, institution, start_date, end_date, gpa, honors.
- For project, use attributes: name, description, url, tech_stack, highlights.
- For certification, use attributes: name, issuer, date, url.
- For skill_* classes, use an attribute named values containing a list of strings.
- For meta_* classes, use an attribute named value.
- Do not invent data. Skip unknown fields instead of guessing.
""".strip()

RESUME_EXAMPLES = [
  ExampleData(
    text=(
      "Jane Doe\n"
      "jane@example.com | +1 555 100 2000 | Austin, TX\n"
      "LinkedIn: https://linkedin.com/in/janedoe\n"
      "Acme Corp | Senior Software Engineer | Jan 2022 - Present | Austin, TX\n"
      "Built workflow automation for recruiting and onboarding.\n"
      "Skills: TypeScript, React, SQL, Leadership\n"
      "B.S. Computer Science, UT Austin, 2017 - 2021\n"
    ),
    extractions=[
      Extraction("identity_name", "Jane Doe", attributes={"value": "Jane Doe"}),
      Extraction(
        "identity_email",
        "jane@example.com",
        attributes={"value": "jane@example.com"},
      ),
      Extraction(
        "identity_phone",
        "+1 555 100 2000",
        attributes={"value": "+1 555 100 2000"},
      ),
      Extraction(
        "identity_location",
        "Austin, TX",
        attributes={"value": "Austin, TX"},
      ),
      Extraction(
        "identity_linkedin",
        "https://linkedin.com/in/janedoe",
        attributes={"value": "https://linkedin.com/in/janedoe"},
      ),
      Extraction(
        "work_experience",
        "Acme Corp | Senior Software Engineer | Jan 2022 - Present | Austin, TX",
        attributes={
          "company": "Acme Corp",
          "title": "Senior Software Engineer",
          "start_date": "2022-01",
          "end_date": "",
          "current": "true",
          "location": "Austin, TX",
          "description": "Built workflow automation for recruiting and onboarding.",
          "achievements": ["Built workflow automation for recruiting and onboarding."],
          "skills_used": ["TypeScript", "React", "SQL"],
        },
      ),
      Extraction(
        "education",
        "B.S. Computer Science, UT Austin, 2017 - 2021",
        attributes={
          "degree": "B.S.",
          "field": "Computer Science",
          "institution": "UT Austin",
          "start_date": "2017",
          "end_date": "2021",
        },
      ),
      Extraction(
        "skill_technical",
        "TypeScript, React, SQL",
        attributes={"values": ["TypeScript", "React", "SQL"]},
      ),
      Extraction(
        "skill_soft",
        "Leadership",
        attributes={"values": ["Leadership"]},
      ),
    ],
  ),
  ExampleData(
    text=(
      "Rahul Verma\n"
      "rahul@example.com\n"
      "Portfolio: https://rahul.dev\n"
      "Project Atlas - Built a job-search dashboard using Python and FastAPI.\n"
      "AWS Certified Developer - Amazon Web Services - 2024\n"
      "Notice period: 30 days\n"
    ),
    extractions=[
      Extraction("identity_name", "Rahul Verma", attributes={"value": "Rahul Verma"}),
      Extraction(
        "identity_email",
        "rahul@example.com",
        attributes={"value": "rahul@example.com"},
      ),
      Extraction(
        "identity_portfolio",
        "https://rahul.dev",
        attributes={"value": "https://rahul.dev"},
      ),
      Extraction(
        "project",
        "Project Atlas - Built a job-search dashboard using Python and FastAPI.",
        attributes={
          "name": "Project Atlas",
          "description": "Built a job-search dashboard using Python and FastAPI.",
          "tech_stack": ["Python", "FastAPI"],
        },
      ),
      Extraction(
        "certification",
        "AWS Certified Developer - Amazon Web Services - 2024",
        attributes={
          "name": "AWS Certified Developer",
          "issuer": "Amazon Web Services",
          "date": "2024",
        },
      ),
      Extraction(
        "meta_notice_period_days",
        "30 days",
        attributes={"value": "30"},
      ),
    ],
  ),
]


def _string(value: Any) -> str:
  if isinstance(value, str):
    return value.strip()
  if value is None:
    return ""
  return str(value).strip()


def _string_list(value: Any) -> list[str]:
  if isinstance(value, list):
    return [_string(item) for item in value if _string(item)]
  if isinstance(value, str):
    parts = [part.strip() for part in value.split(",")]
    return [part for part in parts if part]
  return []


def _bool(value: Any) -> bool:
  if isinstance(value, bool):
    return value
  return _string(value).lower() in {"true", "yes", "current", "present"}


def _number(value: Any) -> int | None:
  digits = "".join(char for char in _string(value) if char.isdigit())
  return int(digits) if digits else None


def _default_profile() -> dict[str, Any]:
  return {
    "identity": {
      "name": "",
      "email": "",
      "phone": "",
      "location": "",
      "linkedin": "",
      "github": "",
      "portfolio": "",
    },
    "work_history": [],
    "education": [],
    "skills": {
      "technical": [],
      "soft": [],
      "tools": [],
      "languages": [],
    },
    "projects": [],
    "certifications": [],
    "meta": {},
  }


def _serialize_extractions(extractions: list[Extraction]) -> list[dict[str, Any]]:
  return [
    {
      "extraction_class": extraction.extraction_class,
      "extraction_text": extraction.extraction_text,
      "attributes": extraction.attributes or {},
    }
    for extraction in extractions
  ]


_SKILL_BUCKET_MAP: dict[str, str] = {
  "technical": "technical",
  "soft": "soft",
  "tool": "tools",
  "language": "languages",
}


def _apply_extraction(profile: dict[str, Any], extraction: Extraction) -> None:
  attributes = extraction.attributes or {}
  extraction_class = extraction.extraction_class

  if extraction_class.startswith("identity_"):
    identity_field = extraction_class.replace("identity_", "")
    profile["identity"][identity_field] = _string(
      attributes.get("value") or extraction.extraction_text
    )
    return

  if extraction_class == "work_experience":
    profile["work_history"].append(
      {
        "company": _string(attributes.get("company")),
        "title": _string(attributes.get("title")),
        "start_date": _string(attributes.get("start_date")),
        "end_date": _string(attributes.get("end_date")),
        "current": _bool(attributes.get("current")),
        "location": _string(attributes.get("location")),
        "description": _string(attributes.get("description")),
        "achievements": _string_list(attributes.get("achievements")),
        "skills_used": _string_list(attributes.get("skills_used")),
      }
    )
    return

  if extraction_class == "education":
    item = {
      "degree": _string(attributes.get("degree")),
      "field": _string(attributes.get("field")),
      "institution": _string(attributes.get("institution")),
      "start_date": _string(attributes.get("start_date")),
      "end_date": _string(attributes.get("end_date")),
      "honors": _string_list(attributes.get("honors")),
    }
    gpa = _string(attributes.get("gpa"))
    if gpa:
      try:
        item["gpa"] = float(gpa)
      except ValueError:
        pass
    profile["education"].append(item)
    return

  if extraction_class.startswith("skill_"):
    raw_bucket = extraction_class.replace("skill_", "")
    skill_bucket = _SKILL_BUCKET_MAP.get(raw_bucket, raw_bucket)
    if skill_bucket not in profile["skills"]:
      profile["skills"][skill_bucket] = []
    profile["skills"][skill_bucket].extend(_string_list(attributes.get("values")))
    return

  if extraction_class == "project":
    profile["projects"].append(
      {
        "name": _string(attributes.get("name") or extraction.extraction_text),
        "description": _string(attributes.get("description")),
        "url": _string(attributes.get("url")),
        "tech_stack": _string_list(attributes.get("tech_stack")),
        "highlights": _string_list(attributes.get("highlights")),
      }
    )
    return

  if extraction_class == "certification":
    profile["certifications"].append(
      {
        "name": _string(attributes.get("name") or extraction.extraction_text),
        "issuer": _string(attributes.get("issuer")),
        "date": _string(attributes.get("date")),
        "url": _string(attributes.get("url")),
      }
    )
    return

  if extraction_class == "meta_notice_period_days":
    value = _number(attributes.get("value") or extraction.extraction_text)
    if value is not None:
      profile["meta"]["notice_period_days"] = value
    return

  if extraction_class == "meta_current_ctc":
    value = _number(attributes.get("value") or extraction.extraction_text)
    if value is not None:
      profile["meta"]["current_ctc"] = value
    return

  if extraction_class == "meta_expected_ctc":
    value = _number(attributes.get("value") or extraction.extraction_text)
    if value is not None:
      profile["meta"]["expected_ctc"] = value
    return

  if extraction_class == "meta_work_mode_preference":
    profile["meta"]["work_mode_preference"] = _string(
      attributes.get("value") or extraction.extraction_text
    ).lower()
    return

  if extraction_class == "meta_visa_status":
    profile["meta"]["visa_status"] = _string(
      attributes.get("value") or extraction.extraction_text
    )


def extract_profile_with_langextract(
  text: str,
  provider: ProviderConfig,
  preferred_model: str | None,
) -> tuple[dict[str, Any], list[dict[str, Any]], list[ParseDiagnostic], str]:
  model, selected_model, diagnostics = build_langextract_model(provider, preferred_model)
  annotated_document = lx.extract(
    text_or_documents=text,
    prompt_description=PROMPT_DESCRIPTION,
    examples=RESUME_EXAMPLES,
    model=model,
    use_schema_constraints=True,
    temperature=provider.temperature or 0.1,
    max_char_buffer=4000,
    debug=False,
  )

  extractions = list(getattr(annotated_document, "extractions", []) or [])
  profile = _default_profile()
  for extraction in extractions:
    _apply_extraction(profile, extraction)

  if selected_model != provider.model:
    diagnostics.append(
      ParseDiagnostic(
        stage="provider",
        code="parse_model_selected",
        message=f"Using {selected_model} for resume parsing.",
      )
    )

  return profile, _serialize_extractions(extractions), diagnostics, selected_model
