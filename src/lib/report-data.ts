export function selectCurrentScanInsights<Risk, Recommendation, Opportunity>(scan: {
  riskFindings: Risk[];
  recommendations: Recommendation[];
  opportunities: Opportunity[];
}) {
  return {
    riskFindings: scan.riskFindings,
    recommendations: scan.recommendations,
    opportunities: scan.opportunities,
  };
}
