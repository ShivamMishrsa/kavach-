"""Sending the sign-in and confirmation emails.

In development (no SMTP settings) the email is written to a file instead of being sent, so the
flow can be tried and tested without a mail service. In production, without SMTP settings, nothing
is sent and only a general error is logged (never the address).
"""

import logging
import smtplib
from email.message import EmailMessage
from pathlib import Path
from typing import Literal, Protocol

from app.core.jsonl import append_record

log = logging.getLogger("kavach.mail")

Kind = Literal["sign_in", "change_email"]

# (subject, body) in each language. The body has {link} and {minutes}. Drafts: a native speaker
# should read them before launch.
_MESSAGES: dict[Kind, dict[str, tuple[str, str]]] = {
    "sign_in": {
        "en": (
            "Your Kavach sign-in link",
            "Open this link to sign in to Kavach. It works once and expires in {minutes} minutes."
            "\n\n{link}\n\nIf you did not ask for it, ignore this email. Nobody can sign in "
            "without it.",
        ),
        "hi": (
            "आपका कवच साइन-इन लिंक",
            "कवच में साइन इन करने के लिए यह लिंक खोलें। यह एक ही बार काम करता है और {minutes} मिनट में "
            "समाप्त हो जाता है।\n\n{link}\n\nअगर आपने इसे नहीं माँगा, तो इस ईमेल को अनदेखा करें। इसके बिना "
            "कोई साइन इन नहीं कर सकता।",
        ),
        "mr": (
            "तुमचा कवच साइन-इन लिंक",
            "कवचमध्ये साइन इन करण्यासाठी हा लिंक उघडा. तो एकदाच चालतो आणि {minutes} मिनिटांत संपतो."
            "\n\n{link}\n\nतुम्ही हा मागवला नसेल तर हा ईमेल दुर्लक्षित करा. त्याशिवाय कोणीही साइन इन "
            "करू शकत नाही.",
        ),
        "bn": (
            "আপনার কবচ সাইন-ইন লিংক",
            "কবচে সাইন ইন করতে এই লিংকটি খুলুন। এটি একবারই কাজ করে এবং {minutes} মিনিটে মেয়াদ শেষ হয়।"
            "\n\n{link}\n\nআপনি না চেয়ে থাকলে এই ইমেল উপেক্ষা করুন। এটি ছাড়া কেউ সাইন ইন করতে পারবে না।",
        ),
        "ta": (
            "உங்கள் கவச் உள்நுழைவு இணைப்பு",
            "கவச்-இல் உள்நுழைய இந்த இணைப்பைத் திறக்கவும். இது ஒரு முறை மட்டுமே வேலை செய்யும்; "
            "{minutes} நிமிடங்களில் காலாவதியாகும்.\n\n{link}\n\nநீங்கள் கேட்கவில்லை என்றால் இந்த "
            "மின்னஞ்சலைப் புறக்கணிக்கவும். இது இல்லாமல் யாரும் உள்நுழைய முடியாது.",
        ),
        "te": (
            "మీ కవచ్ సైన్-ఇన్ లింక్",
            "కవచ్‌లో సైన్ ఇన్ చేయడానికి ఈ లింక్ తెరవండి. ఇది ఒక్కసారే పనిచేస్తుంది, {minutes} "
            "నిమిషాల్లో గడువు ముగుస్తుంది.\n\n{link}\n\nమీరు అడగకపోతే ఈ ఇమెయిల్‌ను పట్టించుకోకండి. "
            "ఇది లేకుండా ఎవరూ సైన్ ఇన్ చేయలేరు.",
        ),
        "gu": (
            "તમારી કવચ સાઇન-ઇન લિંક",
            "કવચમાં સાઇન ઇન કરવા આ લિંક ખોલો. તે એક જ વાર કામ કરે છે અને {minutes} મિનિટમાં સમાપ્ત "
            "થાય છે.\n\n{link}\n\nતમે માંગી ન હોય તો આ ઇમેઇલ અવગણો. તેના વિના કોઈ સાઇન ઇન કરી શકતું નથી.",
        ),
    },
    "change_email": {
        "en": (
            "Confirm your new email address for Kavach",
            "Open this link to confirm this address for your Kavach account. It works once and "
            "expires in {minutes} minutes.\n\n{link}\n\nIf you did not ask for this change, ignore "
            "this email. Nothing will change.",
        ),
        "hi": (
            "कवच के लिए अपना नया ईमेल पता पक्का करें",
            "अपने कवच खाते के लिए यह पता पक्का करने को यह लिंक खोलें। यह एक ही बार काम करता है और "
            "{minutes} मिनट में समाप्त हो जाता है।\n\n{link}\n\nअगर आपने यह बदलाव नहीं माँगा, तो इस ईमेल "
            "को अनदेखा करें। कुछ नहीं बदलेगा।",
        ),
        "mr": (
            "कवचसाठी तुमच्या नवीन ईमेल पत्त्याची खात्री करा",
            "तुमच्या कवच खात्यासाठी हा पत्ता निश्चित करण्यासाठी हा लिंक उघडा. तो एकदाच चालतो आणि "
            "{minutes} मिनिटांत संपतो.\n\n{link}\n\nहा बदल तुम्ही मागितला नसेल तर हा ईमेल दुर्लक्षित करा. "
            "काहीही बदलणार नाही.",
        ),
        "bn": (
            "কবচের জন্য আপনার নতুন ইমেল ঠিকানা নিশ্চিত করুন",
            "আপনার কবচ অ্যাকাউন্টের জন্য এই ঠিকানা নিশ্চিত করতে লিংকটি খুলুন। এটি একবারই কাজ করে এবং "
            "{minutes} মিনিটে মেয়াদ শেষ হয়।\n\n{link}\n\nআপনি এই পরিবর্তন না চেয়ে থাকলে ইমেলটি উপেক্ষা "
            "করুন। কিছুই বদলাবে না।",
        ),
        "ta": (
            "கவச்-க்கான உங்கள் புதிய மின்னஞ்சல் முகவரியை உறுதிசெய்யுங்கள்",
            "உங்கள் கவச் கணக்கிற்கு இந்த முகவரியை உறுதிசெய்ய இந்த இணைப்பைத் திறக்கவும். இது ஒரு முறை "
            "மட்டுமே வேலை செய்யும்; {minutes} நிமிடங்களில் காலாவதியாகும்.\n\n{link}\n\nநீங்கள் இந்த "
            "மாற்றத்தைக் கேட்கவில்லை என்றால் இந்த மின்னஞ்சலைப் புறக்கணிக்கவும். எதுவும் மாறாது.",
        ),
        "te": (
            "కవచ్ కోసం మీ కొత్త ఇమెయిల్ చిరునామాను నిర్ధారించండి",
            "మీ కవచ్ ఖాతా కోసం ఈ చిరునామాను నిర్ధారించడానికి ఈ లింక్ తెరవండి. ఇది ఒక్కసారే "
            "పనిచేస్తుంది, {minutes} నిమిషాల్లో గడువు ముగుస్తుంది.\n\n{link}\n\nమీరు ఈ మార్పు "
            "అడగకపోతే ఈ ఇమెయిల్‌ను పట్టించుకోకండి. ఏమీ మారదు.",
        ),
        "gu": (
            "કવચ માટે તમારું નવું ઇમેઇલ સરનામું ખાતરી કરો",
            "તમારા કવચ ખાતા માટે આ સરનામું ખાતરી કરવા આ લિંક ખોલો. તે એક જ વાર કામ કરે છે અને "
            "{minutes} મિનિટમાં સમાપ્ત થાય છે.\n\n{link}\n\nતમે આ ફેરફાર માંગ્યો ન હોય તો આ ઇમેઇલ અવગણો. "
            "કંઈ બદલાશે નહીં.",
        ),
    },
}


def message(kind: Kind, language: str | None, link: str, minutes: int) -> tuple[str, str]:
    """The subject and body in the person's language (English when it is not known)."""
    by_language = _MESSAGES[kind]
    subject, body = by_language.get(language or "en", by_language["en"])
    return subject, body.format(link=link, minutes=minutes)


class Mailer(Protocol):
    def send(self, to: str, subject: str, body: str) -> None: ...


class FileMailer:
    """Development only: writes each email to a file."""

    def __init__(self, path: Path) -> None:
        self._path = path

    def send(self, to: str, subject: str, body: str) -> None:
        append_record(self._path, {"to": to, "subject": subject, "body": body})


class SmtpMailer:
    def __init__(
        self, host: str, port: int, user: str | None, password: str | None, sender: str
    ) -> None:
        self._host, self._port = host, port
        self._user, self._password = user, password
        self._sender = sender

    def send(self, to: str, subject: str, body: str) -> None:
        email = EmailMessage()
        email["From"], email["To"], email["Subject"] = self._sender, to, subject
        email.set_content(body)
        with smtplib.SMTP(self._host, self._port, timeout=15) as smtp:
            smtp.starttls()
            if self._user and self._password:
                smtp.login(self._user, self._password)
            smtp.send_message(email)


class NoMailer:
    """Production without SMTP settings: nothing can be sent."""

    def send(self, to: str, subject: str, body: str) -> None:
        log.error("Email not sent: no mail service is configured")
