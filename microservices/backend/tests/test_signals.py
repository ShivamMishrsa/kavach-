import pytest

from app.detection.signals import detect_signals


@pytest.mark.parametrize(
    ("text", "code"),
    [
        ("You are under digital arrest.", "digital_arrest"),
        ("Stay on the video call, you are in police custody.", "digital_arrest"),
        ("The investigation requires you to join a WhatsApp call.", "digital_arrest"),
        ("आपको डिजिटल अरेस्ट किया गया है", "digital_arrest"),
        ("वीडियो कॉल पर रहें, आप हिरासत में हैं", "digital_arrest"),
        ("Transfer Rs 50,000 to the account below", "payment_demand"),
        ("You must pay ₹ 5,000 today", "payment_demand"),
        ("deposit 20000 rupees now", "payment_demand"),
        ("₹50,000 तुरंत ट्रांसफर करें", "payment_demand"),
        ("50,000 रुपये जमा करें", "payment_demand"),
        ("Move your money to the RBI safe account", "safe_account"),
        ("a verification account will hold your funds", "safe_account"),
        ("सुरक्षित खाते में पैसे डालें", "safe_account"),
        ("Do not tell anyone about this case.", "secrecy"),
        ("This is a secret matter, keep it confidential.", "secrecy"),
        ("किसी को न बताएं", "secrecy"),
        ("Pay immediately or face action", "urgency"),
        ("Respond within 2 hours", "urgency"),
        ("You will be arrested today", "urgency"),
        ("आपके खिलाफ गिरफ्तारी वारंट है", "urgency"),
    ],
)
def test_signal_is_found(text: str, code: str):
    assert code in detect_signals(text)


@pytest.mark.parametrize(
    "text",
    [
        "Rs 1,200 debited from your account on 12/11/2026.",
        "Do not share your OTP with anyone.",
        "Your OTP is 123456. Never share it with anyone.",
        "Log in to your secure account to view your statement.",
        "Thank you for shopping with us. Your order will arrive tomorrow.",
        "आपका ऑर्डर कल पहुँच जाएगा",
        "",
    ],
)
def test_honest_messages_raise_no_signal(text: str):
    assert detect_signals(text) == set()


def test_hindi_signals_survive_the_mistakes_ocr_makes_in_vowel_signs():
    # What Tesseract actually produced for "डिजिटल अरेस्ट में हैं" and "सुरक्षित खाते".
    assert "digital_arrest" in detect_signals("आप डजिटिल अरेसूट में हैं")
    assert "safe_account" in detect_signals("सुरकषति खाते में ट्रांसफर करें")


def test_a_hindi_signal_does_not_spill_into_the_next_sentence():
    assert "payment_demand" not in detect_signals("₹500 का बिल आया है। कल हम जमा करेंगे")


def test_several_signals_together():
    text = "Digital arrest! Do not tell anyone. Pay Rs 50000 immediately to the safe account."
    assert detect_signals(text) == {
        "digital_arrest",
        "secrecy",
        "payment_demand",
        "urgency",
        "safe_account",
    }
