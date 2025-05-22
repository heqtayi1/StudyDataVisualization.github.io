
const studentId1 = '10de703c06bf9d873d68';  // 你要展示的学生 ID
const studentId2 = '1367d35cf39783effa7a'; 
const studentId3 = '2krjeqjgjqfuumdo3ibt'; 
function setChartByID(studentId,elementId,cluster){
    const chart = echarts.init(document.getElementById(elementId));
    fetch('student_kp_rose_data.json')
    .then(res => res.json())
    .then(data => {
        const studentData = data[studentId];  // 提取某一个学生的数据

        if (!studentData || !studentData.inner || !studentData.outer) {
        console.error("学生数据结构不完整");
        return;
        }
        chart.setOption({
        title: {
            text: cluster+'典型学生知识点掌握度',
            left: 'center'
        },
        tooltip: {
            trigger: 'item'
        },
        series: [
            {
            name: '主知识点',
            type: 'pie',
            radius: ['0%', '40%'],
            label: {
                position: 'inner',
                formatter: '{b}\n{c}'
            },
            data: studentData.inner
            
            },
            {
            name: '子知识点',
            type: 'pie',
            radius: ['50%', '75%'],
            roseType: 'area',
            label: {
                formatter: '{b}',
                color: '#333'
            },
            data: studentData.outer.map(item => ({
                name: item.name,
                value: item.value
            }))
            }
        ]
        });
    });
}
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

setChartByID(studentId2,'chartKnowTypical2','cluster0');
setChartByID(studentId3,'chartKnowTypical3','cluster1');
setChartByID(studentId1,'chartKnowTypical1','cluster2');

lazyPlayChartAnimation('chartKnowTypical1');
lazyPlayChartAnimation('chartKnowTypical2');
lazyPlayChartAnimation('chartKnowTypical3');

setupChartAnimationOnView('chartKnowTypical1');
setupChartAnimationOnView('chartKnowTypical2');
setupChartAnimationOnView('chartKnowTypical3');