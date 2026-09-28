"""Mechanical evidence coverage; never a relevance or answer-quality verdict."""


def evidence_state(available, read, page):
    available, read = set(available), set(read)
    current = {row['path'] for row in page['results']}
    if not read <= available or not current <= available:
        raise RuntimeError('Evidence state contains unobserved sources')
    partial = {row['path'] for row in page['results']
               if row.get('sourceReadRequired') or row.get('previewOmitted')}
    return {
        'candidatesObserved': len(available),
        'originalsDelivered': len(read),
        'observedWithoutOriginal': len(available - read),
        'earlierPageWithoutOriginal': len(available - current - read),
        'currentPartialPreviewWithoutOriginal': len(partial - read),
        'moreCandidatesAvailable': page['hasMore'],
        'semanticCompleteness': 'not_assessed',
    }
