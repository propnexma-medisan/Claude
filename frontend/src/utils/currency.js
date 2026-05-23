export function formatMAD(n) {
  return new Intl.NumberFormat('fr-MA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0) + ' Dhs';
}
