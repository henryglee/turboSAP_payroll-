# backend/tests/test_payment_method_graph.py

import pytest
from backend.payment_method_graph import payment_method_graph

def test_payment_method_flow():
    # Simulate a full set of answers that a customer might submit
    state = {
        "session_id": "test-session",
        "answers": {
            "q1_payment_method_p": "yes",
            "q1_p_house_banks": "Bank A, Bank B",
            "q1_p_ach_spec": "NACHA standard file",

            "q2_payment_method_q": "yes",
            "q2_q_volume": "200 checks per pay period",
            "q2_q_check_range": "100000–199999",

            "q3_payment_method_k": "no",

            "q4_payment_method_m": "yes",

            "q5_pre_note_confirmation": "agree",
        },
    }

    result = payment_method_graph.invoke(state)
    methods = result.get("payment_methods", [])

    # ---------- basic assertions ----------
    assert result.get("done") is True
    assert len(methods) == 5

    # ACH (P)
    method_p = methods[0]
    assert method_p["code"] == "P"
    assert method_p["used"] is True
    assert method_p["house_banks"] == "Bank A, Bank B"
    assert "ACH" in method_p["description"]

    # Physical Check (Q)
    method_q = methods[1]
    assert method_q["code"] == "Q"
    assert method_q["used"] is True
    assert "checks per pay period" in method_q["check_volume"]

    # Pay Card (K)
    method_k = methods[2]
    assert method_k["code"] == "K"
    assert method_k["used"] is False

    # Manual Check (M)
    method_m = methods[3]
    assert method_m["code"] == "M"
    assert method_m["used"] is True

    # Pre-note
    pre_note = methods[4]
    assert pre_note["code"] == "PRE_NOTE"
    assert pre_note["agree_no_pre_note"] is True
    assert pre_note["raw_answer"] == "agree"
