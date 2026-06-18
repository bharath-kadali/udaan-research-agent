from udaan_parsing.chunking import chunk_pages


def test_tracks_sections_and_drops_short_paragraphs():
    pages = [
        "Introduction\n\n"
        "This is an introductory paragraph that is clearly long enough to be retained.\n\n"
        "Results\n\n"
        "The results paragraph is also comfortably long enough to be kept as a chunk.\n\n"
        "short"
    ]
    chunks = chunk_pages(pages)

    assert [c.section for c in chunks] == ["Introduction", "Results"]
    assert all(len(c.text) >= 40 for c in chunks)
    assert all(c.page_number == 1 for c in chunks)
    assert not any(c.text == "short" for c in chunks)
