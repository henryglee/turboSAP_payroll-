"""
API routes for AI-powered configuration assistant.

Provides contextual AI messages for the hybrid config interface.
Medium verbosity - professional but with helpful context.

Works with or without OpenAI API key - falls back to static messages if no key.
"""

import os
from fastapi import APIRouter, HTTPException, Body
from typing import Optional
from pathlib import Path

# Load environment variables
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)

router = APIRouter(prefix="/api/ai-config", tags=["AI Config"])

# Initialize OpenAI client only if API key exists
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Only import and initialize OpenAI if we have a key
client = None
AI_ENABLED = False

if OPENAI_API_KEY and OPENAI_API_KEY.strip():
    try:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        AI_ENABLED = True
        print("[AI Config] OpenAI client initialized successfully")
    except Exception as e:
        print(f"[AI Config] Failed to initialize OpenAI: {e}")
        AI_ENABLED = False
else:
    print("[AI Config] No OpenAI API key found - using static fallback messages")


@router.get("/status")
async def get_ai_status():
    """
    Check if AI features are configured and available.

    Returns:
        {
            "enabled": true/false,
            "message": "Status message for display"
        }
    """
    if AI_ENABLED:
        return {
            "enabled": True,
            "message": "AI assistant is active"
        }
    else:
        return {
            "enabled": False,
            "message": "AI features require enterprise API configuration (OpenAI, Anthropic, etc.). Contact your administrator to enable intelligent assistance."
        }

# System prompt for enterprise SAP consulting context
SYSTEM_PROMPT = """You are an SAP Payroll configuration consultant helping enterprise clients set up payroll areas.

Your role:
- Guide users through configuration with professional, helpful explanations
- Explain WHY each choice matters for their SAP implementation
- Provide context from real-world implementations when relevant
- Keep responses concise but informative (2-3 sentences typically)

Communication style:
- Professional and confident, like an experienced consultant
- Concise but not curt - include relevant context
- Use plain language, explain SAP terms when they appear
- Don't be overly enthusiastic or use filler phrases

SAP knowledge to reference:
- Payroll areas (T549A) group employees for payroll processing
- Each area needs its own calendar (T549Q) with pay periods
- Frequencies: Weekly (Calendar 80), Bi-weekly (20), Semi-monthly (30), Monthly (40)
- Hawaii/Puerto Rico/Alaska need separate areas for tax handling
- Business unit separation enables independent GL posting and processing

Never make up specific SAP details. If unsure, say "we'll configure that detail in the next phase."
"""

# Static fallback messages (used if OpenAI fails)
FALLBACK_MESSAGES = {
    "frequencies": "Select the pay frequencies your organization uses. Each frequency will have its own payroll calendar and processing schedule.",
    "frequency-details": "Now configure the pay period pattern and pay days for each frequency. These determine when pay periods end and when employees receive payment.",
    "regions": "If you have employees in Hawaii, Puerto Rico, or Alaska, they typically need separate payroll areas due to different tax rules and time zones.",
    "business-units": "Business unit separation allows different divisions to have independent payroll processing, GL postings, and reporting.",
    "review": "Your configuration is complete. Review the payroll areas above and export when ready.",
}


@router.post("/message")
async def get_ai_message(request: dict = Body(...)):
    """
    Generate a contextual AI message for the current configuration step.

    Request body:
        {
            "step": "frequencies" | "frequency-details" | "regions" | "business-units" | "review",
            "config": { ... current config state ... },
            "currentFrequency": "weekly" (optional, for frequency-details step),
            "userQuestion": "What is..." (optional, if user asked a question)
        }

    Returns:
        {
            "message": "AI-generated contextual message"
        }
    """
    step = request.get("step", "frequencies")
    config = request.get("config", {})
    current_frequency = request.get("currentFrequency")
    user_question = request.get("userQuestion")

    try:
        if user_question:
            # User asked a clarifying question
            message = await _answer_question(user_question, step, config, current_frequency)
        else:
            # Generate step introduction
            message = await _generate_step_message(step, config, current_frequency)

        return {"message": message}

    except Exception as e:
        # Fallback to static message
        print(f"AI message error: {e}")
        fallback = FALLBACK_MESSAGES.get(step, "Let's continue with the configuration.")
        return {"message": fallback}


async def _generate_step_message(step: str, config: dict, current_frequency: Optional[str]) -> str:
    """Generate an introduction message for a configuration step."""

    # Build context from current config
    context_parts = []

    frequencies = config.get("frequencies", [])
    if frequencies:
        context_parts.append(f"Selected frequencies: {', '.join(frequencies)}")

    freq_configs = config.get("frequencyConfigs", {})
    configured_count = sum(1 for f, c in freq_configs.items()
                          if c.get("periods") and any(p.get("paydays") for p in c["periods"].values()))
    if configured_count > 0:
        context_parts.append(f"{configured_count} frequency/frequencies fully configured")

    regions = config.get("regions", [])
    if regions:
        context_parts.append(f"Regions: {', '.join(regions)}")

    context = "\n".join(context_parts) if context_parts else "Starting fresh configuration"

    # Build prompt based on step
    if step == "frequencies":
        prompt = """Generate a brief introduction (2-3 sentences) for selecting pay frequencies.

Mention that most companies use 1-3 frequencies, and different employee types often have different frequencies (hourly vs salaried).
End with a natural transition to the selection."""

    elif step == "frequency-details":
        freq_label = current_frequency.upper() if current_frequency else "this frequency"
        prompt = f"""The user is now configuring {freq_label} payroll.

Generate a brief message (2-3 sentences) explaining:
- They need to select the pay period pattern (when the pay period starts/ends)
- Then select which days employees get paid
- These combine to create the payroll calendar

Current config context:
{context}"""

    elif step == "regions":
        prompt = f"""The user has configured their pay frequencies and is now deciding on regional separation.

Generate a brief message (2-3 sentences) explaining:
- Hawaii, Puerto Rico, and Alaska typically need separate payroll areas
- This is due to different state/territory tax handling and time zone considerations
- Ask if they have employees in these regions

Current config context:
{context}"""

    elif step == "business-units":
        prompt = f"""The user is deciding on business unit separation.

Generate a brief message (2-3 sentences) explaining:
- Business unit separation allows different divisions to process payroll independently
- This is useful for separate GL postings, different processing schedules, or audit requirements
- Ask if they need this separation

Current config context:
{context}"""

    elif step == "review":
        prompt = f"""The user has completed their configuration.

Generate a brief congratulatory message (2-3 sentences):
- Confirm the configuration is complete
- Mention they can review the payroll areas in the table
- Indicate they can export when ready

Current config context:
{context}"""

    else:
        return FALLBACK_MESSAGES.get(step, "Let's continue.")

    # If AI not enabled, return fallback immediately
    if not AI_ENABLED or client is None:
        return FALLBACK_MESSAGES.get(step, "Let's continue with the configuration.")

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            max_tokens=150,
            temperature=0.7
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"OpenAI error: {e}")
        return FALLBACK_MESSAGES.get(step, "Let's continue with the configuration.")


async def _answer_question(question: str, step: str, config: dict, current_frequency: Optional[str]) -> str:
    """Answer a user's clarifying question."""

    # Build context
    context_parts = [f"Current step: {step}"]

    if current_frequency:
        context_parts.append(f"Currently configuring: {current_frequency}")

    frequencies = config.get("frequencies", [])
    if frequencies:
        context_parts.append(f"Selected frequencies: {', '.join(frequencies)}")

    context = "\n".join(context_parts)

    prompt = f"""The user asked a question while configuring their SAP payroll areas.

Context:
{context}

User's question: "{question}"

Provide a helpful, concise answer (2-4 sentences). Be informative but not overwhelming.
If the question is outside your knowledge, say "That's a detail we'll configure in the next phase" rather than guessing.
End by gently redirecting back to the current configuration step."""

    # If AI not enabled, return a helpful fallback
    if not AI_ENABLED or client is None:
        return f"That's a great question about {step}. For now, let's focus on completing this step, and we can address specifics in the detailed configuration phase."

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            max_tokens=200,
            temperature=0.7
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"OpenAI error: {e}")
        return f"That's a great question about {step}. For now, let's focus on completing this step, and we can address specifics in the detailed configuration phase."
