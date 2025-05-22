
var chartDom = document.getElementById('clusterKnowMainMaster');
var myChart = echarts.init(chartDom);

fetch('student_cluster_data.json')
  .then(res => res.json())
  .then(data => {
    //console.log(data);  // 检查这里输出的数据格式
    var CLUSTER_COUNT = 3;
    var COLOR_ALL = [
      '#536ec3',
      '#91cc75',
      '#e8ba52',
    ];
    var pieces = [];
    for (var i = 0; i < CLUSTER_COUNT; i++) {
      pieces.push({
        value: i,
        label: 'cluster ' + i,
        color: COLOR_ALL[i]
      });
    }
    var option = {
      dataset: [{
        source: data
      }],
      tooltip: {
        formatter: function(params) {
          return `x: ${params.data[0].toFixed(3)}<br/>y: ${params.data[1].toFixed(3)}<br/>cluster: ${params.data[2]}`;
        },
        position: 'top'
      },
      visualMap: {
        type: 'piecewise',
        dimension: 2,  // cluster 所在列索引
        pieces: pieces,
        left: 10,
        top: 'middle'
      },
      xAxis: {},
      yAxis: {},
      series: {
        type: 'scatter',
        encode: { x: 0, y: 1 },
        symbolSize: 15,
        itemStyle: { borderColor: '#555' },
        colorBy: 'data'
      }
    };
    myChart.setOption(option);
  });

   fetch('cluster_centers.json')
      .then(response => response.json())
      .then(data => {
        const indicators = [
          { name: 'active_days', max: 70 },
          { name: 'unique_questions_attempted', max: 50 },
          { name: 'avg_attempts_per_unique_question', max: 6 },
          { name: 'unique_correct_questions', max: 50 },
          { name: 'consecutive_days', max: 50 }
        ];

        const seriesData = data.map(item => ({
          value: [
            item.active_days,
            item.unique_questions_attempted,
            item.avg_attempts_per_unique_question,
            item.unique_correct_questions,
            item.consecutive_days
          ],
          name: item.cluster
        }));

        const chart = echarts.init(document.getElementById('clusterAbility'));
        const option = {
          title: {
            text: '聚类特征雷达图'
          },
          tooltip: {},
          legend: {
            data: data.map(item => item.cluster)
          },
          radar: {
            indicator: indicators,
            radius: '65%'
          },
          series: [{
            type: 'radar',
            data: seriesData
          }]
        };

        chart.setOption(option);
      });
