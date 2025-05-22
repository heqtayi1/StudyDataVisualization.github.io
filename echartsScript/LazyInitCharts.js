function lazyPlayChartAnimation(domId) {
  const chartDom = document.getElementById(domId);
  if (!chartDom) return;

  const myChart = echarts.getInstanceByDom(chartDom);
  if (!myChart) return;

  const option = myChart.getOption(); // 获取当前 option

  // 临时清空系列数据 → 再填充回来
  const originalSeries = option.series;

  // 暂时清空数据
  const emptySeries = originalSeries.map(s => ({
    ...s,
    data: []
  }));

  // 先清空数据（触发过渡动画）
  myChart.setOption({ series: emptySeries });

  // 再稍后恢复数据（重新触发动画）
  setTimeout(() => {
    
    myChart.setOption({
      series: originalSeries,
      animation: true
    });
  }, 50);
}

function setupChartAnimationOnView(domId) {
  const chartDom = document.getElementById(domId);
  if (!chartDom) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // 每次进入视口就播放动画
        lazyPlayChartAnimation(domId);
      }
    });
  }, {
    threshold: 0.3
  });

  observer.observe(chartDom);
}