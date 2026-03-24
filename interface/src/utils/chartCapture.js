import html2canvas from 'html2canvas';

export const captureCharts = async () => {
  try {
    // Capture the entire dashboard container
    const dashboardElement = document.querySelector('.MuiGrid-container');
    if (!dashboardElement) {
      console.error('Dashboard container not found');
      return null;
    }

    const canvas = await html2canvas(dashboardElement, {
      backgroundColor: '#ffffff',
      scale: 2, // Higher resolution
      useCORS: true,
      allowTaint: true
    });

    // Convert to blob for download
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png', 1.0);
    });

    return { canvas, blob };
  } catch (error) {
    console.error('Error capturing charts:', error);
    return null;
  }
};

export const downloadChartImage = (blob, filename = 'dashboard_charts.png') => {
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};