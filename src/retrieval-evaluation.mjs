export function summarizeSelectiveRetrieval(scoredRuns, abstentionRuns) {
  const answerable = Array.isArray(scoredRuns) ? scoredRuns : []
  const unanswerable = Array.isArray(abstentionRuns) ? abstentionRuns : []
  const answerableAccepted = answerable.filter((run) => !run.abstained).length
  const falseAbstentions = answerable.length - answerableAccepted
  const unanswerableAbstained = unanswerable.filter((run) => run.abstained).length
  const falseAnswers = unanswerable.length - unanswerableAbstained
  const correctAcceptedRetrievals = answerable.filter(
    (run) => !run.abstained && run.metrics?.hit === 1,
  ).length
  const total = answerable.length + unanswerable.length

  return {
    answerableAcceptanceAccuracy: answerable.length
      ? answerableAccepted / answerable.length
      : 1,
    abstentionAccuracy: unanswerable.length
      ? unanswerableAbstained / unanswerable.length
      : 1,
    answerabilityDecisionAccuracy: total
      ? (answerableAccepted + unanswerableAbstained) / total
      : 1,
    selectiveAccuracy: total
      ? (correctAcceptedRetrievals + unanswerableAbstained) / total
      : 1,
    confusion: {
      answerableAccepted,
      falseAbstentions,
      unanswerableAbstained,
      falseAnswers,
      correctAcceptedRetrievals,
    },
  }
}
