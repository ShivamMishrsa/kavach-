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


# Found by measuring the rules on the labelled sets (see docs/benchmarks.md).
def test_the_threat_may_come_in_the_sentence_after_the_video_call():
    text = "Talk to the officer on a WhatsApp video call. Failing which an arrest will follow."
    assert "digital_arrest" in detect_signals(text)


def test_a_weak_word_in_another_sentence_does_not_count():
    assert "digital_arrest" not in detect_signals(
        "Join the zoom call. We discuss the investigation."
    )


def test_warranty_is_not_a_warrant():
    assert "digital_arrest" not in detect_signals("Join the video call about the warranty claim.")
    assert "digital_arrest" in detect_signals("Stay on the video call, a warrant is issued.")


def test_hindi_in_english_letters_is_understood():
    assert "digital_arrest" in detect_signals("Video call par rahiye, warna giraftari hogi")
    assert "payment_demand" in detect_signals("40,000 rupees transfer karein")
    assert "secrecy" in detect_signals("Family ko bhi nahi batana")
    assert "urgency" in detect_signals("turant call karo")


def test_telling_a_relative_a_surprise_is_not_secrecy():
    assert "secrecy" not in detect_signals("dad ko mat batana ki surprise party hai")


def test_offering_to_pay_is_not_a_demand_to_pay():
    assert "payment_demand" not in detect_signals("I will transfer Rs 800 tonight")
    assert "payment_demand" in detect_signals("You will transfer Rs 800 tonight")


def test_a_deposit_account_is_not_a_demand_to_deposit():
    assert "payment_demand" not in detect_signals("Your fixed deposit of Rs 1,00,000 matures soon")
    assert "payment_demand" in detect_signals("Deposit Rs 1,00,000 now")


def test_a_hindi_credit_alert_is_not_a_demand_to_deposit():
    assert "payment_demand" not in detect_signals("आपके खाते में ₹12,000 जमा हुए हैं। शेष ₹31,450।")
    assert "payment_demand" in detect_signals("अभी ₹12,000 जमा करें")


def test_the_banks_own_otp_warning_is_not_secrecy_pressure():
    assert "secrecy" not in detect_signals("Aapka login OTP 3382 hai. Kisi ko mat batayein.")
    assert "secrecy" in detect_signals("Aapke account mein problem hai. Kisi ko mat batayein.")


def test_hindi_stay_on_the_call_after_an_official_is_recognised():
    assert "digital_arrest" in detect_signals("सीबीआई का नोटिस है। वीडियो कॉल चालू रखिए।")
    assert "digital_arrest" not in detect_signals("दोस्तों के साथ वीडियो कॉल चालू रखिए।")


def test_an_or_else_threat_on_a_video_call_from_an_official_is_recognised():
    assert "digital_arrest" in detect_signals(
        "Customs officer here. Video call pe aaiye, warna police aayegi"
    )
    assert "digital_arrest" not in detect_signals(
        "Video call pe aaiye, warna hum movie miss kar denge"
    )


def test_a_warrant_that_will_be_issued_is_urgent():
    assert "urgency" in detect_signals("A warrant will be issued unless you settle")
    assert "urgency" not in detect_signals("The warranty will be issued with the invoice")


def test_a_supervision_account_in_hindi_is_a_safe_account_demand():
    assert "safe_account" in detect_signals("पैसे आरबीआई के निगरानी खाते में डालिए")
