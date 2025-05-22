var chartKnowSubMaster = echarts.init(document.getElementById('chartKnowSubMaster'));
chartKnowMainMaster.on('click', function (params) {
  // 获取点击的主知识点名
  const clickedKnowledgePoint = params.name;
  // 调试输出
  console.log('点击了主知识点：', clickedKnowledgePoint);
 fetch(`knowledge_groups/${clickedKnowledgePoint}.json`)
  .then(res => res.json())
  .then(data => {
    console.log("Loaded data:", data);

    // 处理数据为雷达图格式
    const seriesData = data.map(item => ({
      name: item.sub_knowledge || '未知',
      value: [
        item.avg_normalized_score ?? 0,
        item.accuracy_rate ?? 0,
        item.avg_timeconsume ?? 0,
        item.avg_memory ?? 0
      ]
    }));

    const option = {
      title: {
         text: `${clickedKnowledgePoint} - 次要知识点掌握度雷达图`
      },
      tooltip: {},
      legend: {
        top: 'bottom',
        data: seriesData.map(item => item.name)
      },
      radar: {
        indicator: [
          { name: '得分', max: 1 },
          { name: '正确率', max: 1 },
          { name: '时间复杂度', max: 1 },
          { name: '空间复杂度', max: 1 }
        ]
      },
      series: [
        {
          name: '次要知识点掌握度',
          type: 'radar',
          data: seriesData
        }
      ]
    };
  chartKnowSubMaster.setOption(option);
  });
});
