class ExtractionError(Exception):
    """Raised by the extractor to signal a specific HTTP status."""
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code
