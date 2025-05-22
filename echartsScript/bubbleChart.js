var bubbleChart = echarts.init(document.getElementById('bubbleChart'));
var scoreDistributionChart = echarts.init(document.getElementById('scoreDistributionChart'));
var errorTypeChart = echarts.init(document.getElementById('errorTypeChart'));

    fetch('keshihua/bubble_chart_data.json').then(res => res.json()).then(data => {
      var option = {
        title: {
          text: '气泡图'
        },
        tooltip: {
          trigger: 'item',
          formatter: function (params) {
            return `Title ID: ${params.data[3]}<br>Avg Knowledge Mastery: ${params.data[0].toFixed(2)}<br>Avg Score Rate: ${params.data[1].toFixed(2)}<br>Avg Attempts: ${params.data[2]}`;
          }
        },
        xAxis: {
          type: 'value',
          name: 'Avg Knowledge Mastery'
        },
        yAxis: {
          type: 'value',
          name: 'Avg Score Rate'
        },
        series: [{
          type: 'scatter',
          data: data.map(item => [item[1], item[2], item[3], item[0]]),
          symbolSize: function (data) {
            return Math.sqrt(data[2] / 10); // 根据尝试次数调整气泡大小
          },
          itemStyle: {
            color: function (params) {
              var knowledgeMastery = params.value[0];
              var scoreRate = params.value[1];
              var attempts = params.value[2];
              // 综合判断难易程度
              if (knowledgeMastery < 0.4 && scoreRate < 0.1 && attempts > 1330) {
                return 'red'; // 过难
              } else if (knowledgeMastery > 1.0 && scoreRate > 0.3 && attempts < 1340) {
                return 'green'; // 过易
              }
              return 'gray'; // 适中
            }
          }
        }]
      };
      bubbleChart.setOption(option);

      // 注册点击事件
      bubbleChart.on('click', function (params) {
        if (params.dataIndex !== null) {
          var titleId = params.data[3];
          // document.getElementById('scoreDistributionChart').style.display = 'block';
          // document.getElementById('errorTypeChart').style.display = 'block';

          fetch(`keshihua/score_distribution_data_${titleId}.json`).then(res => res.json()).then(scoreData => {
            var scoreOption = {
              title: {
                text: '得分分布直方图'
              },
              tooltip: {},
              xAxis: {
                type: 'category',
                data: Object.keys(scoreData)
              },
              yAxis: {
                type: 'value'
              },
              series: [{
                data: Object.values(scoreData),
                type: 'bar'
              }]
            };
            scoreDistributionChart.setOption(scoreOption);
          }).catch(err => {
            console.error('Error loading score distribution data:', err);
          });

          fetch(`keshihua/error_type_distribution_data_${titleId}.json`).then(res => res.json()).then(errorData => {
            var errorOption = {
              title: {
                text: '错误类型饼图'
              },
              tooltip: {
                trigger: 'item'
              },
              legend: {
                data: Object.keys(errorData)
              },
              series: [{
                name: 'Error Type',
                type: 'pie',
                radius: '55%',
                data: Object.values(errorData).map((value, key) => ({value: value, name: key}))
              }]
            };
            errorTypeChart.setOption(errorOption);
          }).catch(err => {
            console.error('Error loading error type distribution data:', err);
          });
        }
      });
    });

    var charts = {
      'weakPointsChart': {
        title: '薄弱知识点数',
        value: 3,
        total: 8,
        icon: '⬇️'
      },
      'hardQuestionsChart': {
        title: '过难题目数',
        value: 3,
        total: 44,
        icon: '⚠️'
      },
      'easyQuestionsChart': {
        title: '过易题目数',
        value: 5,
        total: 44,
        icon: '✅'
      },
      
      'efficiencyChart': {
        title: '高效模式比率',
        value: 25,
        total: 100,
        icon: '📈'
      },
     'suggestedTimeChart': {
        
        value: 2, // 建议时段为2小时
        total: 24, // 全天24小时
        icon: '⏰'
      }
    };

    for (var chartId in charts) {
      var chart = echarts.init(document.getElementById(chartId));
      if (chartId === 'suggestedTimeChart') {
        var option = {
          title: {
            text: charts[chartId].title,
            left: 'center',
        
        textStyle: {
          fontSize: 16,
          color: '#000'
        }
      },
      tooltip: {
        formatter: '{a} <br/>{b} : 19：00-21：00'
      },
      series: [
        {
          name: '时段',
          type: 'gauge',
          startAngle: 90,
          endAngle: -270,
          min: 0,
          max: 12,
          center: ['50%', '50%'],
          radius: '80%',
          splitNumber: 12,
          axisLine: {
            lineStyle: {
              width: 8,
              color: [
                [7/12, '#CCCCCC'], // 7:00之前为灰色
                [9/12, '#FFA500'], // 7:00-9:00 为橙色
                [1, '#CCCCCC']     // 9:00之后为灰色
              ]
            }
          },
          axisTick: {
            length: 6,
            lineStyle: {
              color: '#fff'
            }
          },
          axisLabel: {
            color: '#fff',
            distance: -30,
            formatter: function (value) {
              return value + ':00';
            }
          },
          splitLine: {
            length: 10,
            lineStyle: {
              width: 2,
              color: '#fff'
            }
          },
          pointer: {
            width: 5,
            length: '80%',
            itemStyle: {
              color: 'auto'
            }
          },
          detail: {
            valueAnimation: true,
            formatter: '19-21',
            offsetCenter: [0, '70%'],
            textStyle: {
              fontSize: 14,
              color: '#000'
            }
          },
          data: [
            {
              value: 8 , // 8:00 对应的值
              name: '建议时段',
              title: {
                offsetCenter: [0, '30%'],
                textStyle: {
                  fontSize: 14,
                  color: '#000'
                }
              },
              detail: {
                valueAnimation: true,
                offsetCenter: [0, '70%']
                  }
                }
              ]
            }
          ]
        };
      } else {
        var option = {
          title: {
            text: charts[chartId].title,
            left: 'center'
          },
          tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b}: {c} ({d}%)'
          },
          series: [
            {
              name: 'KPI',
              type: 'pie',
              radius: '50%',
              data: [
                {value: charts[chartId].value, name: charts[chartId].icon},
                {value: charts[chartId].total - charts[chartId].value, name: '其他'}
              ],
              itemStyle: {
                color: function(params) {
                  return params.name === charts[chartId].icon ? '#FFA500' : '#CCCCCC';
                }
              }
            }
          ]
        };
      }
      chart.setOption(option);
      // 为每个图表添加点击事件
      if (chartId === 'weakPointsChart') {
        chart.on('click', function (params) {
          if (params.name === '⬇️') {
            showModal('weakPointsModal');
          }
        });
      } else if (chartId === 'hardQuestionsChart') {
        chart.on('click', function (params) {
          if (params.name === '⚠️') {
            showModal('hardQuestionsModal');
          }
        });
      } else if (chartId === 'easyQuestionsChart') {
        chart.on('click', function (params) {
          if (params.name === '✅') {
            showModal('easyQuestionsModal');
          }
        });
      } else if (chartId === 'efficiencyChart') {
        chart.on('click', function (params) {
          if (params.name === '📈') {
            showModal('efficiencyModal');
          }
        });
      } else if (chartId === 'suggestedTimeChart') {
    chart.on('click', function () {
      showModal('suggestedTimeModal');
    });
  }
}

   // 显示模态框的函数
function showModal(modalId) {
  var modal = document.getElementById(modalId);
  modal.style.display = 'block';

  // 获取对应的关闭按钮并添加事件监听器
  var closeBtnId = 'close' + modalId.charAt(0).toUpperCase() + modalId.slice(1);
  var closeBtn = document.getElementById(closeBtnId);
  closeBtn.onclick = function() {
    modal.style.display = 'none';
  };

  // 点击模态框外部关闭
  window.onclick = function(event) {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  };
}

