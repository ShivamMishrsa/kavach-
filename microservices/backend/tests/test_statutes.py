from app.detection.statutes import find_statutes, mentions_old_law
from app.models import Statute


def cited(text: str) -> list[tuple[str, str]]:
    return [(s.cited, s.current) for s in find_statutes(text)]


def test_old_law_names_are_noticed():
    for text in (
        "under IPC",
        "Indian Penal Code",
        "CrPC applies",
        "Cr.P.C. 41A",
        "Code of Criminal Procedure",
        "Indian Evidence Act",
        "भारतीय दंड संहिता की धारा 420",
    ):
        assert mentions_old_law(text), text


def test_new_law_names_and_plain_text_are_not_flagged():
    for text in ("Bharatiya Nyaya Sanhita section 318", "a recipe for chicken", "TOPIC 420"):
        assert not mentions_old_law(text), text


def test_section_before_the_act():
    assert cited("Section 420 IPC") == [("IPC 420", "BNS 318(4)")]
    assert cited("u/s 120B of the Indian Penal Code") == [("IPC 120B", "BNS 61(2)")]
    assert cited("sec. 406 of IPC") == [("IPC 406", "BNS 316(2)")]


def test_act_before_the_section():
    assert cited("IPC 420") == [("IPC 420", "BNS 318(4)")]
    assert cited("IPC Section 384") == [("IPC 384", "BNS 308(2)")]


def test_crpc_sections_map_to_bnss():
    assert cited("notice under Section 41A CrPC") == [("CrPC 41A", "BNSS 35(3)")]
    assert cited("Section 160 of Cr.P.C.") == [("CrPC 160", "BNSS 179")]


def test_hindi_label_and_act_name():
    assert cited("धारा 420 भारतीय दंड संहिता") == [("IPC 420", "BNS 318(4)")]


def test_several_sections_in_the_order_they_appear_without_repeats():
    text = "Section 420 IPC, Section 468 IPC and again IPC 420"
    assert cited(text) == [("IPC 420", "BNS 318(4)"), ("IPC 468", "BNS 336(3)")]


def test_a_section_without_a_known_replacement_is_not_listed():
    assert cited("Section 999 IPC") == []
    assert mentions_old_law("Section 999 IPC")


def test_statute_shape():
    assert find_statutes("IPC 420")[0] == Statute(cited="IPC 420", current="BNS 318(4)")


def test_a_list_of_sections_before_the_act():
    assert cited("Sections 420, 406 and 120B of IPC") == [
        ("IPC 420", "BNS 318(4)"),
        ("IPC 406", "BNS 316(2)"),
        ("IPC 120B", "BNS 61(2)"),
    ]
    assert cited("Section 420 and Section 406 IPC") == [
        ("IPC 420", "BNS 318(4)"),
        ("IPC 406", "BNS 316(2)"),
    ]
