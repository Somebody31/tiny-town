# Example Devin assignment

**Ballot winner:** Law 9, “Station staff must wear hard hats.”

**Base:** The current town commit. Replay the previous day's station fixture with its stored seed and snapshot.

**Affected behavior:** Boarding rulings for residents wearing hats on the platform.

**Assignment:** Add a failing test showing that a conductor wearing a hard hat may board under staff law 9, while a passenger wearing the same hat is fined under general law 4. Implement the law and make both tests pass. Run the full test suite and replay yesterday's incident. Open a pull request with the behavior change and replay result. A replay fine against an unrelated resident such as the baker gets one retry. If it remains, pause the job for human review. The law takes effect only after the pull request is reviewed.

This is the task template printed by the local demo. It does not contact Devin or open a pull request.
