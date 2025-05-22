
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


fetch('main_knowledge_mastery_summary.json')
  .then(res => res.json())
  .then(data => {
    const chartDom = document.getElementById('ScatterKnowSubMaster');
    const myChart = echarts.init(chartDom);

    // 计算两个指标的平均值
    const avgTime = data.reduce((sum, item) => sum + item.avg_timeconsume, 0) / data.length;
    const avgAccuracy = data.reduce((sum, item) => sum + item.accuracy_rate, 0) / data.length;
    //console.log(avgTime, avgAccuracy);

    const option = {
      title: {
        text: '知识点时空复杂度与正确率散点图',
      },
      tooltip: {
        trigger: 'item',
        formatter: params => {
          const d = params.data;
          return `
            知识点: ${d[3]}<br/>
            正确率: ${d[1].toFixed(2)}<br/>
            时间复杂度: ${d[0]}<br/>
            空间复杂度: ${d[2]}
          `;
        }
      },
      xAxis: {
        name: '时空复杂度',
        type: 'value',
        min: 0,
        max: 'dataMax',
        splitLine: { show: false },
        axisLine: { onZero: false },
      },
      yAxis: {
        name: '正确率',
        type: 'value',
        min: 0,
        max: 0.5,
        splitLine: { show: false },
      },
      series: [{
        symbolSize: 10,
        type: 'scatter',
        data: data.map(item => [
          item.avg_timeconsume,
          item.accuracy_rate,
          item.avg_memory,
          item.knowledge_point
        ]),
        // 添加平均值参考线
        markLine: {
          silent: true,
          data: [
            { xAxis: avgTime },
            { yAxis: avgAccuracy }
          ],
          label: {
            formatter: function (param) {
              return param.value !== undefined ? `均值: ${param.value.toFixed(2)}` : '';
            }
          },
          lineStyle: {
            type: 'dashed',
            color: '#FF0000'
          }
        }
      }]
    };
     myChart.setOption(option);
  });

//知识点掌握直方图
var chartKnowMainMaster = echarts.init(document.getElementById('chartKnowMainMaster'));
fetch('main_knowledge_mastery_summary.json')
    .then(res => res.json())
    .then(data => {
      const labelOption = {
        show: true,
        position: 'insideBottom',
        distance: 15,
        align: 'left',
        verticalAlign: 'middle',
        rotate: 90,
        formatter: '{name|{a}}',
        fontSize: 16,
        rich: {
          name: {}
        }
      };

      const option = {
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow'
          }
        },
        legend: {
          data: ['得分', '正确率', '时间复杂度', '空间复杂度']
        },
        xAxis: [
          {
            type: 'category',
            axisTick: { show: false },
            data: data.map(item => item.knowledge_point),
          }
        ],
        yAxis: [
          {
            type: 'value'
          }
        ],
        series: [
          {
            name: '得分',
            type: 'bar',
            label: labelOption,
            emphasis: { focus: 'series' },
            data: data.map(item => item.avg_normalized_score)
          },
          {
            name: '正确率',
            type: 'bar',
            label: labelOption,
            emphasis: { focus: 'series' },
            data: data.map(item => item.accuracy_rate)
          },
          {
            name: '时间复杂度',
            type: 'bar',
            label: labelOption,
            emphasis: { focus: 'series' },
            data: data.map(item => item.avg_timeconsume)
          },
          {
            name: '空间复杂度',
            type: 'bar',
            label: labelOption,
            emphasis: { focus: 'series' },
            data: data.map(item => item.avg_memory)
          }
        ]
      };

      chartKnowMainMaster.setOption(option);
     });

setupChartAnimationOnView('chartKnowMainMaster');
setupChartAnimationOnView('ScatterKnowSubMaster');