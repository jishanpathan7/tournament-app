"""Registration domain — intake → approval → Participant/Team.

Separates the mutable, reviewable *application* (Registration) from the structural
*competitor* (Participant). Approval creates the Participant (and a Team + roster for
doubles/team divisions), delegating roster-shape validation to the Sport Profile — no
reimplementation of sport rules here.
"""
