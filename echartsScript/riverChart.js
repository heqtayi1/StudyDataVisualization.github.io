 const base = 'output_json';
  //const modeColors = ['#FAC858', '#91CC75', '#5470C6']; // 模式0(黄), 模式1(绿), 模式2(蓝)
  const coolColorScheme = ['#E0F7FA', '#B2EBF2', '#80DEEA', '#4DD0E1', '#26C6DA', '#00BCD4', '#00ACC1', '#0097A7', '#00838F', '#006064'].reverse(); // 浅蓝到深青
  const neutralGrayPalette = ['#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525'];
   // *** 配色方案定义 ***
  const modeColors = ['#FFCA28', '#66BB6A', '#42A5F5']; // 更明亮的黄、绿、蓝 (模式0, 1, 2)

  // 为分数段和知识点定义更细致的色板
  // 分数段: 可以用灰阶或与模式色调和谐的浅色
  const scoreLevelPalette = {
      '低分段': chroma('#BDBDBD').alpha(0.8).hex(), // 浅灰
      '中分段': chroma('#9E9E9E').alpha(0.8).hex(), // 中灰
      '高分段': chroma('#757575').alpha(0.8).hex(), // 深灰
      '整体组': chroma('#E0E0E0').alpha(0.8).hex(),
      '较低分组': chroma('#D1C4E9').alpha(0.8).hex(), // 浅紫
      '较高分组': chroma('#9575CD').alpha(0.8).hex()  // 中紫
  };

  // 知识点：可以使用一个多色但和谐的色板，或者根据模式/分数段颜色动态生成
  const knowledgeBaseColors = ['#B8C1EC', '#A3C9A8', '#F6D6AD', '#C3B299', '#A1C6EA']; // 一组基础色
  
  
  // I.1 多层嵌套雷达
  Promise.all([
    fetch(base + '/radar_all_profile_data.json').then(res => res.json())
  ]).then(([radarDataObj]) => {
    console.log("Fetched Radar Data Object:", radarDataObj); // 调试: 打印获取到的雷达图总数据
    const radarGroups = Object.keys(radarDataObj);

    radarGroups.forEach((groupName, index) => {
        const containerId = `radar_chart_${index + 1}`;
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Radar chart container ${containerId} not found.`);
            return;
        }
        const radarChart = echarts.init(container);
        const groupChartData = radarDataObj[groupName];

        if (!groupChartData || !groupChartData.indicator || !groupChartData.series_data) {
            console.error(`Data for radar group ${groupName} is invalid or missing parts. Indicator:`, groupChartData.indicator, "Series Data:", groupChartData.series_data);
            return;
        }
        
        const sortedSeriesData = [...groupChartData.series_data].sort((a, b) => { // 创建副本再排序
            const numA = parseInt(a.name.replace('模式', ''));
            const numB = parseInt(b.name.replace('模式', ''));
            return numA - numB;
        });
        
        const radarOption = {
            title: {
                text: groupName + '特征雷达图',
                left: 'center',
                top: '5%', // 调整标题位置
                textStyle: { fontSize: 14, fontWeight: 'normal' } // 调整字体
            },
            tooltip: { trigger: 'item' },
            legend: index === 0 ? {
                data: sortedSeriesData.map(s => s.name),
                bottom: '2%', // 调整图例位置
                left: 'center',
                icon: 'circle',
                itemGap: 8,
                textStyle: { fontSize: 11 }
            } : { show: false },
            radar: {
                indicator: groupChartData.indicator,
                radius: '60%', // 调整雷达图大小
                center: ['50%', '58%'], // 调整雷达图中心
                splitNumber: 4, // 减少分割圈数
                axisName: { // 使用 axisName 替代旧版 name
                    color: '#555', 
                    fontSize: 9,
                    overflow: 'breakAll', // 尝试自动换行
                    width: 50, // 限制名称区域宽度以触发换行
                    formatter: function(value) {
                        const maxLengthPerLine = 6; // 每行大致字符数
                        if (value.length > maxLengthPerLine) {
                            let result = '';
                            for (let i = 0; i < value.length; i += maxLengthPerLine) {
                                result += value.substring(i, i + maxLengthPerLine) + '\n';
                            }
                            return result.trim();
                        }
                        return value;
                    }
                },
                splitArea: { areaStyle: { color: ['rgba(250,250,250,0.1)', 'rgba(200,200,200,0.1)']}}, //调整颜色
                splitLine: { lineStyle: { color: '#e0e0e0' }},
                axisLine: { lineStyle: { color: '#cccccc' }}
            },
            series: [{
                type: 'radar',
                data: sortedSeriesData.map((item, i) => ({
                    ...item,
                    symbol: 'circle',
                    symbolSize: 4, // 调小标记点
                    lineStyle: { width: 2, color: modeColors[i % modeColors.length] },
                    itemStyle: { color: modeColors[i % modeColors.length] },
                    areaStyle: { color: modeColors[i % modeColors.length], opacity: 0.2 } // 降低透明度
                })),
                emphasis: { focus: 'series', lineStyle: { width: 2.5 } }
            }]
        };
        console.log(`Radar Option for ${groupName}:`, JSON.stringify(radarOption, null, 2));
        radarChart.setOption(radarOption);
    });
  }).catch(error => console.error("Error fetching or processing radar data:", error));

  // I.2 PCA散点
  fetch(base +'/scatter_cluster_data.json')
  .then(res => res.json())
  .then(data => {
    console.log("Fetched Scatter Data:", data); // 调试: 打印获取到的散点图数据
    const groups = {};
    // 找到所有数据的PC1和PC2的最小最大值，以便更好地设置dataZoom的初始范围
    let minPc1 = Infinity, maxPc1 = -Infinity, minPc2 = Infinity, maxPc2 = -Infinity;
    data.forEach(item => {
      const modeIndex = parseInt(item.category.replace('模式', ''));
      if (!groups[item.category]) {
        groups[item.category] = {
            data: [],
            color: modeColors[modeIndex % modeColors.length] 
        };
      }
      groups[item.category].data.push([item.x, item.y, item.size]);
      // 更新PC1, PC2范围
      if (item.x < minPc1) minPc1 = item.x;
      if (item.x > maxPc1) maxPc1 = item.x;
      if (item.y < minPc2) minPc2 = item.y;
      if (item.y > maxPc2) maxPc2 = item.y;
    });

    const series = Object.keys(groups).sort((a,b) => {
        return parseInt(a.replace('模式','')) - parseInt(b.replace('模式',''));
    }).map((key) => {
      return {
        name: key,
        type: 'scatter',
        data: groups[key].data,
        itemStyle: { color: groups[key].color },
        symbolSize: function (value) { // ECharts symbolSize 回调参数是value(即data数组中的一项)
          return Math.sqrt(value[2]) * 1.5 + 4; // 调整大小逻辑
        },
        emphasis: { focus: 'series', label: { show: false } }, // 强调时不显示标签
        large: true, // 开启大数据量优化
        largeThreshold: 500 // 大数据量优化的阈值
      };
    });

    const scatterChart = echarts.init(document.getElementById('scatterChart'));
    const scatterOption = {
      title: { text: '学习模式散点图', left: 'center', top: '2%' },
      tooltip: {
        trigger: 'item',
        formatter: function (params) {
          return `${params.seriesName}<br/>PC1: ${params.value[0].toFixed(2)}<br/>PC2: ${params.value[1].toFixed(2)}<br/>尝试次数: ${params.value[2]}`;
        }
      },
      legend: {
        data: Object.keys(groups).sort((a,b) => parseInt(a.replace('模式','')) - parseInt(b.replace('模式',''))),
        top: '8%', // 调整图例位置
        selectedMode: 'multiple'
      },
      grid: { top: '18%', bottom: '15%', left: '10%', right: '10%' }, // 为dataZoom留出空间
      xAxis: {name: 'PC1', nameLocation: 'middle', nameGap: 30, // 增加 nameGap
        // *** 修改点：移除 scale: true，让轴根据数据自适应 ***
        // scale: true, 
        splitLine: {show: false},
        axisLabel: { fontSize: 10 }, // 调整坐标轴标签字体大小
        nameTextStyle: { fontSize: 12 } },// 调整轴名称字体大小 
      yAxis: { 
        name: 'PC2', nameLocation: 'middle', nameGap: 35, 
        // *** 修改点：移除 scale: true ***
        // scale: true, 
        splitLine: {show: false},
        axisLabel: { fontSize: 10 },
        nameTextStyle: { fontSize: 12 }
      },       
      dataZoom: [
          { 
            type: 'slider', show: true, xAxisIndex: [0], 
            // *** 修改点：可以稍微调整start/end，或者使用startValue/endValue（如果知道具体范围） ***
            start: 0, // 尝试从0开始，覆盖所有数据
            end: 100,   // 到100结束
            bottom: '3%', // 调整位置
            height: 20 // 调整滑块高度
          },
          { 
            type: 'slider', show: true, yAxisIndex: [0], 
            right: '3%', // 调整位置
            start: 0, 
            end: 100,
            width: 20 // 调整滑块宽度
          },
          { type: 'inside', xAxisIndex: [0], start: 0, end: 100 },
          { type: 'inside', yAxisIndex: [0], start: 0, end: 100 }
      ],
      series: series,
      color: modeColors 
    };
    console.log("Scatter Option with zoom fix attempt:", JSON.stringify(scatterOption, null, 2));
    scatterChart.setOption(scatterOption);
  }).catch(error => console.error("Error fetching or processing scatter data:", error));

  // I.3 热力图
  fetch(base + '/heatmap_peak_time_data.json')
  .then(res => res.json())
  .then(rawData => {
    console.log("Fetched Heatmap Data:", rawData);
    const hours = Array.from({ length: 24 }, (_, i) => `${i}`);
    const days = ['周一','周二','周三','周四','周五','周六','周日'].reverse();

    const data = rawData.map(item => [ item[1], days.indexOf(item[0]), item[2] ]);
    const maxValue = data.length > 0 ? Math.max(...data.map(d => d[2]), 1) : 100;


    const heatmapChart = echarts.init(document.getElementById('heatmapChart'));
    const heatmapOption = {
      title: { text: '学习时间分布热力图', left: 'center', top: '2%' },
      tooltip: {
        position: 'top',
        formatter: function (p) {
          return `${days[p.value[1]]} ${p.value[0]}:00<br/>提交次数：${p.value[2]}`;
        }
      },
      grid: { height: '60%', top: '18%', left: '8%', right: '12%', bottom: '10%' }, // 调整边距
      xAxis: { type: 'category', data: hours, splitArea: { show: true }, axisLabel: { interval: 1 } },
      yAxis: { type: 'category', data: days, splitArea: { show: true } },
      visualMap: {
        min: 0,
        max: maxValue,
        calculable: true,
        orient: 'vertical',
        left: 'right',
        top: 'center',
        itemHeight: 100, // 调整图例高度
        inRange: { color: ['#FFFFE0', '#FFD700', '#FFA500', '#FF4500', '#B22222'] }
      },
      series: [{
        name: '提交频次', type: 'heatmap', data: data, label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } }
      }]
    };
    console.log("Heatmap Option:", JSON.stringify(heatmapOption, null, 2));
    heatmapChart.setOption(heatmapOption);
  }).catch(error => console.error("Error fetching or processing heatmap data:", error));



  // II.2 单平行坐标图
  fetch(base + '/parallel_profile_data.json').then(r => r.json()).then(cfg => {
    console.log("Fetched Parallel Data:", cfg);
    const parallelCfg = cfg.strength; // 假设数据在 strength 键下
    if (!parallelCfg || !parallelCfg.names || !parallelCfg.data) {
        console.error("Parallel data is malformed:", cfg);
        return;
    }
    const patterns = parallelCfg.data.map((_, i) => `模式${i}`);
    const dims = parallelCfg.names.map((n, i) => ({ dim: i, name: n.replace(/_/g, ' ').replace(/ per /g, '/\n') })); // 尝试换行

    const seriesData = parallelCfg.data.map((vals, i) => ({
      value: vals, name: `模式${i}`,
      lineStyle: { color: modeColors[i % modeColors.length] }
    }));

    const parallelOption = {
      title: { text: '投入强度特征平行坐标图', left: 'center', top: '3%' },
      tooltip: { trigger: 'item' },
      parallelAxis: dims.map((d) => ({
        dim: d.dim, name: d.name, type: 'value',
        nameLocation: 'end', nameTextStyle: { fontSize: 10, align: 'left', padding: [0,0,-10,0] }, // 微调标签位置
        axisLabel: { fontSize: 9, margin: 3 }
      })),
      parallel: { left: '8%', right: '12%', bottom: '12%', top: '20%', }, // 调整布局
      legend: { bottom: '2%', data: patterns, icon: 'circle', itemGap: 5, textStyle: { fontSize: 10 } },
      series: [{ type: 'parallel', smooth: false, lineStyle: { width: 2.5, opacity: 0.65 }, data: seriesData }]
    };
    console.log("Parallel Option:", JSON.stringify(parallelOption, null, 2));
    echarts.init(document.getElementById('parallelSingleChart')).setOption(parallelOption);
  }).catch(error => console.error("Error fetching or processing parallel data:", error));

  // II.3 样本数柱状
  fetch(base+'/bar_profile_data.json').then(r=>r.json()).then(j=>{
    console.log("Fetched Bar Profile Data:", j);
    const barDataWithColor = j.map(item => ({
        value: item.count, name: item.pattern,
        itemStyle: { color: modeColors[parseInt(item.pattern.replace('模式', '')) % modeColors.length] }
    }));
    const barOption = {
      title:{text:'各模式学生数量',left:'center', top: '5%'},
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { top: '20%', bottom: '15%', left: '15%', right: '10%' },
      xAxis:{type:'category',data:j.map(d=>d.pattern), axisLabel: {fontSize: 11}},
      yAxis:{type:'value', name: '学生数量', nameTextStyle: {fontSize: 11}, axisLabel: {fontSize: 10}},
      series:[{ type:'bar', data:barDataWithColor, barWidth: '50%', label: { show: true, position: 'top' } }]
    };
    console.log("Bar Profile Option:", JSON.stringify(barOption, null, 2));
    echarts.init(document.getElementById('barProfileChart')).setOption(barOption);
  }).catch(error => console.error("Error fetching or processing bar profile data:", error));


//////////////////////////////////////////////////
//   // II.1 桑基图
//   //console.log("Attempting to initialize Sankey chart...");
//   const sankeyChartContainer = document.getElementById('sankeyChart');
//   if (!sankeyChartContainer) {
//       console.error("Sankey chart container 'sankeyChart' not found in DOM!");
//   } else {
//       fetch(base + '/sankey_pattern_score_qtype.json')
//           .then(r => {
//               if (!r.ok) { throw new Error(`HTTP error! status: ${r.status}`); }
//               return r.json();
//           })
//           .then(j => {
//               console.log("Fetched Sankey Data for EXTREME simplified test:", JSON.parse(JSON.stringify(j)));

//               if (!j || !j.nodes || !j.links || !Array.isArray(j.nodes) || !Array.isArray(j.links) || j.nodes.length === 0 || j.links.length === 0) {
//                   console.error("Sankey data is empty or malformed for EXTREME simplified test.", j);
//                   sankeyChartContainer.innerHTML = "<p style='text-align:center;color:red;'>桑基图数据无效！</p>";
//                   return;
//               }

//               // *** 极简配置 ***
//               const extremelySimplifiedSankeyOption = {
//                   title: { text: '桑基图 - 极简测试' },
//                   tooltip: { trigger: 'item', triggerOn: 'mousemove' },
//                   series: [{
//                       type: 'sankey',
//                       data: j.nodes,  // 直接使用原始节点数据
//                       links: j.links, // 直接使用原始链接数据
//                       layout: 'none', // 使用最基础的布局
//                       label: { show: true } // 确保标签显示
//                   }]
//               };
//               console.log("EXTREMELY Simplified Sankey Option:", JSON.stringify(extremelySimplifiedSankeyOption, null, 2));
              
//               try {
//                   const sankeyChartInstance = echarts.init(sankeyChartContainer);
//                   sankeyChartInstance.setOption(extremelySimplifiedSankeyOption, true);
//                   console.log("EXTREMELY Simplified Sankey chart option set.");
//               } catch (e) {
//                   console.error("Error during ECharts init or setOption (EXTREMELY simplified):", e);
//                    sankeyChartContainer.innerHTML = `<p style='text-align:center;color:red;'>桑基图初始化或设置选项失败: ${e.message}</p>`;
//               }

//           })
//           .catch(error => {
//               console.error("Error fetching or processing sankey data (EXTREMELY simplified test):", error);
//               if (sankeyChartContainer) {
//                 sankeyChartContainer.innerHTML = `<p style='text-align:center;color:red;'>桑基图加载失败: ${error.message}</p>`;
//               }
//           });
//   }
  

  // II.1 桑基图
    // II.1 桑基图
  console.log("Attempting to initialize Sankey chart...");
  const sankeyChartContainer = document.getElementById('sankeyChart'); // 获取容器元素
  if (!sankeyChartContainer) {
      console.error("Sankey chart container 'sankeyChart' not found in DOM!");
  } else {
      fetch(base + '/sankey_pattern_score_qtype.json')
          .then(r => {
              if (!r.ok) { throw new Error(`HTTP error! status: ${r.status}`); }
              return r.json();
          })
          .then(j => { // <--- fetch 的第二个 .then() 回调开始
              console.log("Fetched Sankey Data:", JSON.parse(JSON.stringify(j))); 

              if (!j || !j.nodes || !j.links || !Array.isArray(j.nodes) || !Array.isArray(j.links)) {
                  console.error("Sankey data is malformed (nodes or links are missing/not arrays).", j);
                  sankeyChartContainer.innerHTML = "<p style='text-align:center;color:red;'>桑基图数据格式错误！</p>";
                  return; // 数据有问题，提前退出
              }
              if (j.nodes.length === 0 || j.links.length === 0) {
                  console.warn("Sankey data has no nodes or no links.", j);
                  sankeyChartContainer.innerHTML = "<p style='text-align:center;color:orange;'>桑基图数据为空，无法绘制。</p>";
                  // return; // 可以选择在这里也退出
              }
  
              // *** 从这里开始，是你之前错误放置的代码块，现在移入回调函数内部 ***
              const modeColors = ['#FFCA28', '#66BB6A', '#42A5F5']; 

              const scoreLevelSankeyColors = {
                '低分段': '#F6CBA3',
                '中分段': '#A3D9C9',
                '高分段': '#91BDE3',
                '整体组': '#D3D3D3',
                '较低分组': '#F6CBA3',
                '较高分组': '#91BDE3'
              };

              // 确保 chroma.js 已经加载，或者提供一个简单的颜色生成器作为回退
              let knowledgePalette;
              if (typeof chroma !== 'undefined') {
                  knowledgePalette = chroma.scale([
                    '#F3D99B', '#AED9DA', '#A3C4F3', '#C1A3F3', '#F3A3D3', '#F3B8B8'
                  ]).mode('lab').colors(Math.max(j.nodes.length, 1)); // 确保 colors 参数大于0
              } else {
                  // 简单回退色板
                  knowledgePalette = ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462'];
                  console.warn("chroma.js not loaded, using fallback colors for Sankey knowledge nodes.");
              }


              const colorMap = {};
              let knowledgeIndex = 0;

              j.nodes.forEach(node => {
                node.label = { color: '#333', fontSize: 10 };
                node.itemStyle = node.itemStyle || {};
                node.itemStyle.borderWidth = 0.4;
                node.itemStyle.borderColor = 'rgba(0,0,0,0.08)';
                let baseColorString; // 用于chroma

                if (node.name.startsWith('模式')) {
                  const idx = parseInt(node.name.replace('模式', ''));
                  baseColorString = modeColors[idx % modeColors.length];
                  colorMap[node.name] = baseColorString;
                  if (typeof chroma !== 'undefined') {
                      const baseChroma = chroma(baseColorString);
                      node.itemStyle.color = new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: baseChroma.brighten(0.3).hex() },
                        { offset: 1, color: baseChroma.darken(0.2).hex() }
                      ]);
                  } else {
                      node.itemStyle.color = baseColorString;
                  }
                } else if (scoreLevelSankeyColors[node.name]) {
                  baseColorString = scoreLevelSankeyColors[node.name];
                  colorMap[node.name] = baseColorString;
                  if (typeof chroma !== 'undefined') {
                      const baseChroma = chroma(baseColorString);
                      node.itemStyle.color = new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: baseChroma.brighten(0.2).hex() },
                        { offset: 1, color: baseChroma.darken(0.15).hex() }
                      ]);
                  } else {
                      node.itemStyle.color = baseColorString;
                  }
                } else {
                  baseColorString = knowledgePalette[knowledgeIndex % knowledgePalette.length];
                  colorMap[node.name] = baseColorString;
                  if (typeof chroma !== 'undefined') {
                      const colorChroma = chroma(baseColorString);
                      node.itemStyle.color = new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: colorChroma.brighten(0.15).saturate(0.1).hex() },
                        { offset: 1, color: colorChroma.darken(0.2).desaturate(0.1).hex() }
                      ]);
                  } else {
                      node.itemStyle.color = baseColorString;
                  }
                  knowledgeIndex++;
                }
              });

              j.links.forEach(link => {
                const sourceBaseColor = colorMap[link.source] || '#cccccc';
                const targetBaseColor = colorMap[link.target] || '#cccccc';
                if (typeof chroma !== 'undefined') {
                    const sourceChroma = chroma(sourceBaseColor);
                    const targetChroma = chroma(targetBaseColor);
                    link.lineStyle = {
                      color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: sourceChroma.alpha(0.3).hex() },
                        { offset: 1, color: targetChroma.alpha(0.3).hex() }
                      ]),
                      opacity: 0.8, // 保持较高不透明度，因为颜色本身带透明度
                      curveness: 0.5,
                      shadowBlur: 6,
                      shadowColor: 'rgba(0, 0, 0, 0.08)'
                    };
                } else {
                     link.lineStyle = {
                        color: 'source', // ECharts 会自动处理
                        opacity: 0.3,
                        curveness: 0.5
                     };
                }
              });
              
              // *** sankeyOption 的定义现在在这里 ***
              const sankeyOption = {
                title: {
                  text: '学习模式 → 平均分段 → Top知识点偏好',
                  left: 'center',
                  top: '3%',
                  textStyle: { fontSize: 17, fontWeight: '500', color: '#2c3e50' }
                },
                tooltip: {
                  trigger: 'item',
                  triggerOn: 'mousemove',
                  formatter: function (params) {
                    if (params.dataType === 'edge') {
                      return `${params.data.source || ''} → ${params.data.target || ''}<br/><b>${params.data.value || ''}</b> 名学生`;
                    }
                    return `<b>${params.name}</b>`;
                  }
                },
                series: [{
                  type: 'sankey',
                  layout: 'justify',
                  data: j.nodes,
                  links: j.links,
                  nodeWidth: 18,
                  nodeGap: 8,
                  orient: 'horizontal',
                  draggable: true,
                  label: {
                    show: true,
                    position: 'right',
                    distance: 6,
                    fontSize: 10,
                    formatter: function (params) {
                      const name = params.name;
                      return name.length > 8 ? name.slice(0, 7) + '…' : name;
                    }
                  },
                  emphasis: {
                    focus: 'adjacency',
                    lineStyle: { opacity: 0.65, width: 2 }
                  },
                  levels: [
                    { depth: 0, label: { position: 'left', fontSize: 12, fontWeight: 'bold' } },
                    { depth: 1, label: { fontSize: 11 } },
                    { depth: 2, label: { fontSize: 10, color: '#333' } }
                  ]
                }]
              };
              // *** 到这里，sankeyOption 已经定义完毕 ***

              console.log("Sankey Option (Finalized and within scope):", JSON.stringify(sankeyOption, null, 2));
              
              const sankeyChartInstance = echarts.init(sankeyChartContainer); 
              sankeyChartInstance.setOption(sankeyOption, true); // 现在 sankeyOption 是在这个作用域内定义的
              console.log("Sankey chart option set successfully.");

          }) // <--- fetch 的第二个 .then() 回调结束
          .catch(error => {
              console.error("Error fetching or processing sankey data:", error);
              if (sankeyChartContainer) {
                sankeyChartContainer.innerHTML = `<p style='text-align:center;color:red;'>桑基图加载失败: ${error.message}</p>`;
              }
          });
  } // <--- else 语句块结束

  // II.2 单平行坐标图
  fetch(base + '/parallel_profile_data.json').then(r => r.json()).then(cfg => {
    const dom = document.getElementById('parallelSingleChart');
    const chart = echarts.init(dom);
    const patterns = cfg.strength.data.map((_, i) => `模式${i}`); // 确保是 模式0, 模式1, ...
    
    const dims = cfg.strength.names.map((n, i) => ({
      dim: i,
      name: n.replace(/_/g, ' ') // 将下划线替换为空格，美化显示
    }));

    const seriesData = cfg.strength.data.map((vals, i) => ({
      value: vals,
      name: `模式${i}`, // 确保名称一致
      lineStyle: { color: modeColors[i % modeColors.length] } // 为每条线指定颜色
    }));

    chart.setOption({
      title: { text: '投入强度特征平行坐标图', left: 'center' },
      tooltip: {
        trigger: 'item',
        axisPointer: { type: 'line' }
      },
      parallelAxis: dims.map((d, i) => ({
        dim: d.dim,
        name: d.name,
        type: 'value',
        nameLocation: 'end',
        nameTextStyle: { fontSize: 10, padding: [0, 0, 0, -20] }, // 调整名称样式
        axisLabel: { fontSize: 9 } // 调整刻度标签
      })),
      parallel: {
        left: '5%', // 调整边距
        right: '10%',
        bottom: '15%',
        top: '15%',
        parallelAxisDefault: {
            // 可以设置默认的坐标轴样式
        }
      },
      legend: {
        bottom: 5,
        data: patterns,
        icon: 'circle',
        itemGap: 5, // 图例项间距
        textStyle: { fontSize: 10 }
      },
      series: [{
        type: 'parallel',
        smooth: true, // 线条平滑
        lineStyle: { width: 3, opacity: 0.7 }, // 调整线条样式
        data: seriesData
      }]
    });
  });
  // II.3 样本数柱状
  const barP = echarts.init(document.getElementById('barProfileChart'));
  fetch(base+'/bar_profile_data.json').then(r=>r.json()).then(j=>{
    // 确保柱状图颜色与模式对应
    const barDataWithColor = j.map(item => {
        const modeIndex = parseInt(item.pattern.replace('模式', ''));
        return {
            value: item.count,
            name: item.pattern,
            itemStyle: {
                color: modeColors[modeIndex % modeColors.length]
            }
        };
    });

    barP.setOption({
      title:{text:'各模式学生数量',left:'center'},
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis:{type:'category',data:j.map(d=>d.pattern)},
      yAxis:{type:'value', name: '学生数量'},
      series:[{
          type:'bar',
          data:barDataWithColor,
          barWidth: '60%', // 柱子宽度
          label: { // 显示数值
              show: true,
              position: 'top'
          }
        }]
    });
  });


  // --- Section III (Combined III & IV) Charting Code ---

  // III.1 模式化知识点掌握度对比热图
  fetch(base + '/knowledge_mastery_heatmap_data.json').then(r => r.json()).then(data => {
    // ... (之前的console.log和检查) ...
    const heatmapMasteryChartEl = document.getElementById('knowledgeMasteryHeatmapChart');
    if(!heatmapMasteryChartEl) { console.error("Heatmap mastery chart element not found"); return; }
    const heatmapMasteryChart = echarts.init(heatmapMasteryChartEl);
    
    const maxValueHeatmap = data.data.length > 0 ? Math.max(...data.data.map(d => d[2]), 0.01) : 1; // 避免max为0
    const knowledgeMasteryOption = {
        title: { text: '各模式知识点平均分', left: 'center', top: '3%', textStyle: {fontSize: 17, fontWeight:'500', color: '#2c3e50'}},
        tooltip: { position: 'top', formatter: p => `${data.modes[p.value[1]]} <br/>${data.knowledge_points[p.value[0]]}<br/>平均分: ${p.value[2].toFixed(2)}`},
        grid: { height: '70%', top: '15%', left:'18%', right:'12%', bottom:'18%'}, // 调整grid，为X轴标签留更多空间
        xAxis: { type: 'category', data: data.knowledge_points, 
                 axisLabel: { interval: 0, rotate: 45, fontSize: 10, color: '#495057' }, // 调整字体
                 axisTick: {alignWithLabel: true} },
        yAxis: { type: 'category', data: data.modes, axisLabel: { fontSize: 11, color: '#495057', fontWeight:'500' } },
        visualMap: {
            min: 0, max: maxValueHeatmap, calculable: true, orient: 'vertical', right: '3%', top: 'center', 
            itemHeight: 220, precision: 2, textStyle: {fontSize: 10, color: '#333'},
            // *** 热力图冷色系 ***
            inRange: { color: chroma.scale(['#f1eef6', '#bdc9e1', '#74a9cf', '#2b8cbe', '#045a8d']).mode('lch').colors(5) } // 浅蓝紫到深蓝紫
        },
        series: [{
            name: '知识点平均分', type: 'heatmap', data: data.data,
            label: { show: true, formatter: function(params){ return params.value[2] > 0.05 ? params.value[2].toFixed(1) : '';}, fontSize: 9, 
                     color: (params) => chroma(heatmapMasteryOption.visualMap.inRange.color[Math.floor((params.value[2]/maxValueHeatmap)*(heatmapMasteryOption.visualMap.inRange.color.length-1))]).luminance() > 0.5 ? '#212121' : '#f9f9f9' }, // 动态标签颜色
            emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.3)' } }
        }]
    };
    heatmapMasteryChart.setOption(knowledgeMasteryOption);
  }).catch(error => console.error("Error fetching knowledge mastery heatmap data:", error));

  // III.2 知识点序列通过情况 - 径向柱状图 (玉玦图)
  fetch(base + '/radial_bar_knowledge_data.json').then(r => r.json()).then(data => {
    console.log("Fetched Radial Bar (Nightingale Rose) Data:", data);
    const radialBarChartEl = document.getElementById('radialBarKnowledgeChart');
    if (!radialBarChartEl || !data || !Array.isArray(data) || data.length === 0) { /* ...错误处理... */ return; }
    const radialBarChart = echarts.init(radialBarChartEl);
    const radialBarOption = {
        title: { text: '知识点序列通过人数', subtext: '半径表示通过人数 (Top4知识点)',
                 left: 'center', top: '5%', textStyle: { fontSize: 17, fontWeight: '500', color: '#2c3e50' },
                 subtextStyle: { fontSize: 12, color: '#555'}
        },
        tooltip: { trigger: 'item',
            formatter: function(params) {
                return `${params.name.replace('\n', ' ')}<br/>通过人数: <b>${params.value}</b> ${params.data.actual_count !== undefined ? '(实际: ' + params.data.actual_count + '人)' : ''}`;
            }
        },
        legend: { data: modeColors.map((_, i) => `模式${i}`), bottom: '4%', itemGap: 10, textStyle: {fontSize: 12}}, // 放大图例字体
        polar: { radius: ['20%', '78%'], center: ['50%', '58%'] }, // 调整内外圈和中心
        angleAxis: {
            type: 'category', data: data.map(item => item.name), z: 10,
            axisLabel: { interval: 0, fontSize: 10, color: '#495057', lineHeight: 13,
                formatter: function (value) { return value.replace('(模式','\n(模式');} 
            }
        },
        radiusAxis: { show: false },
        series: [{
            type: 'bar', data: data.map(item => ({
                value: item.value, name: item.name, actual_count: item.actual_count, 
                itemStyle: { color: modeColors[item.mode_id % modeColors.length], 
                             borderColor: 'rgba(255,255,255,0.5)', borderWidth: 1.5,
                             shadowBlur: 5, shadowColor: 'rgba(0,0,0,0.2)'} // 添加阴影
            })),
            coordinateSystem: 'polar',
            label: { show: true, position: 'middle', formatter: '{c}', fontSize: 10, color: '#fff', 
                     fontWeight:'600', textShadowColor: 'rgba(0,0,0,0.6)', textShadowBlur: 2},
            emphasis: { focus: 'series', itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.5)'}},
            roseType: 'radius'
        }]
    };
    radialBarChart.setOption(radialBarOption);
  }).catch(error => console.error("Error fetching or processing radial bar data:", error));

  // III.3 主题河流图 - 模式在知识点序列上的进展
  fetch(base + '/theme_river_knowledge_progress_data.json').then(r => r.json()).then(data => {
    // ... (之前的console.log和检查) ...
    const themeRiverChartEl = document.getElementById('themeRiverChart');
    // ... (之前的DOM元素和数据检查) ...
     if (!themeRiverChartEl || !data || !Array.isArray(data) || data.length === 0) { /* ...错误处理... */ return; }

    // *** 修改点：确保X轴标签来自知识点名称 ***
    // 假设data.py中时间维度(data[i][0])已经是知识点名称字符串
    const riverTimeLabels = [...new Set(data.map(item => item[0]))]
                                .sort((a,b) => { 
                                    // 如果data.py中已经是实际知识点名，且knowledge_sequence存在且正确
                                    // 可以用knowledge_sequence的索引来排序，以保证逻辑顺序
                                    // const idxA = typeof knowledge_sequence !== 'undefined' ? knowledge_sequence.indexOf(a) : -1;
                                    // const idxB = typeof knowledge_sequence !== 'undefined' ? knowledge_sequence.indexOf(b) : -1;
                                    // if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                    // Fallback to string or "阶段X" numeric sort
                                    if (String(a).startsWith("阶段") && String(b).startsWith("阶段")) return parseInt(String(a).replace("阶段","")) - parseInt(String(b).replace("阶段",""));
                                    return String(a).localeCompare(String(b));
                                }); 
    
    const themeRiverChart = echarts.init(themeRiverChartEl);
    const themeRiverOption = {
        title: { text: '学习模式在知识点序列的通过人数演变', subtext: '河流宽度表示通过人数',
                 left: 'center', top: '4%', textStyle: { fontSize: 17, fontWeight: '500', color: '#2c3e50' },
                 subtextStyle: { fontSize: 12, color: '#555'}
        },
        tooltip: { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: 'rgba(0,0,0,0.2)', width: 1, type: 'solid' }},
            formatter: function (params) { let res = params[0].axisValueLabel + '<br/>'; params.sort((a,b)=>b.value[1]-a.value[1]); params.forEach(item => {res += `${item.marker}${item.seriesName}: <b>${item.value[1]}</b>人<br/>`;}); return res;}
        },
        legend: { data: modeColors.map((_, i) => `模式${i}`), bottom: '3%', itemGap: 12, textStyle: {fontSize: 15}}, // 放大图例字体
        singleAxis: { top: '20%', bottom: '15%', type: 'category', boundaryGap: false, data: riverTimeLabels, 
                      axisLabel: { fontSize: 11, color: '#495057', interval: 0 }, 
                      axisLine: { show: true, lineStyle: {color: '#AEAEAE'} },
                      axisTick: { show: true, lineStyle: {color: '#AEAEAE'}, alignWithLabel: true, length: 4 }
        },
        series: modeColors.map((color, i) => ({
            name: `模式${i}`, type: 'themeRiver', emphasis: { focus: 'series', itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.3)' }},
            data: data.filter(d => d[2] === `模式${i}`).map(d => [d[0], d[1], d[2]]), 
            itemStyle: { color: chroma(color).alpha(0.85).hex() }, // 应用模式颜色并稍作透明处理
            label: { show: false } 
        }))
    };
    themeRiverChart.setOption(themeRiverOption);
  }).catch(error => console.error("Error fetching or processing theme river data:", error));

  // III.4 旭日图 - (配色和字体调整)
  fetch(base + '/sunburst_preference_data.json').then(r => r.json()).then(data => {
    console.log("Fetched Sunburst Data for ADVANCED styling:", data);
    const sunburstEl = document.getElementById('sunburstPreferenceChart');
    if (!sunburstEl) { console.error("Sunburst chart element not found!"); return; }
    if (!data || !Array.isArray(data) || data.length === 0) {
        sunburstEl.innerHTML = '<p style="text-align:center; color:#888; margin-top:50px;">旭日图数据不足。</p>'; return;
    }
    // *** 旭日图高级配色逻辑 ***
    function styleSunburstNodesAdvanced(nodes, level = 0, parentNodeData = null) {
        nodes.forEach((node, index) => {
            node.label = node.label || {}; 
            node.itemStyle = node.itemStyle || {};
            let currentColor;
            let currentLuminanceFactor = 0; // 用于在同级中产生明暗变化

            if (level === 0 && node.name.startsWith('模式')) { // 模式层
                const modeIndex = parseInt(node.name.replace('模式', ''));
                currentColor = modeColors[modeIndex % modeColors.length];
                node.itemStyle.color = currentColor;
                node.label = { 
                    fontSize:15, fontWeight:'bold', // 增大模式层字体
                    color: chroma(currentColor).luminance() < 0.4 ? '#f0f0f0' : '#212121', // 根据背景亮度决定文字颜色
                    textShadowColor: 'rgba(0,0,0,0.15)', textShadowBlur: 1, textShadowOffsetY:1
                };
            } else if (level === 1 && (node.name.includes('分段') || node.name.includes('分组') || node.name.includes('整体组'))) { // 分数段层
                if (parentNodeData && parentNodeData.itemStyle && parentNodeData.itemStyle.color) {
                    const parentColor = chroma(parentNodeData.itemStyle.color);
                    // 分数段颜色基于父模式颜色，通过调整亮度和饱和度来区分
                    // 例如：低分段更亮/饱和度低，高分段更暗/饱和度略高
                    if (node.name.includes('低')) {
                        currentLuminanceFactor = 0.6; // 较亮
                        currentColor = parentColor.brighten(currentLuminanceFactor).desaturate(0.2).hex();
                    } else if (node.name.includes('中')) {
                        currentLuminanceFactor = 0.3;
                        currentColor = parentColor.brighten(currentLuminanceFactor).hex();
                    } else if (node.name.includes('高')) {
                        currentLuminanceFactor = -0.2; // 较暗
                        currentColor = parentColor.darken(Math.abs(currentLuminanceFactor)).saturate(0.1).hex();
                    } else { // 其他如“整体组”
                        currentLuminanceFactor = 0;
                        currentColor = parentColor.hex();
                    }
                } else { // Fallback
                    currentColor = neutralGrayPalette[index % neutralGrayPalette.length]; // 使用中性色
                }
                node.itemStyle.color = currentColor;
                node.itemStyle.opacity = 0.85; // 给分数段一些透明度
                node.label = { 
                    fontSize:12, // 增大分数段字体
                    color: chroma(currentColor).luminance() < 0.45 ? '#f8f8f8' : '#333', 
                    fontWeight:'500' 
                };
            } else if (level === 2) { // 知识点层
                if (parentNodeData && parentNodeData.itemStyle && parentNodeData.itemStyle.color) {
                    const parentScoreColor = chroma(parentNodeData.itemStyle.color);
                    // 知识点颜色基于分数段颜色进一步细微变化，确保与父级协调但有区分
                    // 使用色相小范围旋转和亮度/饱和度微调
                    // index % 5 产生 0,1,2,3,4. (index % 5 - 2) 产生 -2, -1, 0, 1, 2
                    const hueShift = (index % 5 - 2) * 6; // 小范围色相偏移 (-12 to +12 degrees)
                    const lightnessAdjust = (index % 3 - 1) * 0.1; // 亮度微调 (-0.1, 0, +0.1)
                    currentColor = parentScoreColor.set('hsl.h', `*${1 + hueShift/360}`).brighten(lightnessAdjust).saturate(0.05).hex();
                } else { // Fallback
                    currentColor = knowledgeBaseColors[(colorPaletteIndex + index) % knowledgeBaseColors.length];
                }
                node.itemStyle.color = currentColor;
                node.itemStyle.opacity = 0.9;
                node.label = { 
                    fontSize:9, // 知识点字体
                    color: chroma(currentColor).luminance() < 0.5 ? '#f0f0f0' : '#444' 
                };
            }
            
            // 为子节点递归调用，传递当前节点作为父节点，并更新 colorPaletteIndex (如果使用独立色板的话)
            if (node.children && node.children.length > 0) {
                styleSunburstNodesAdvanced(node.children, level + 1, node /*, colorPaletteIndex + nodes.length */); 
            }
        });
    }

    if (typeof chroma !== 'undefined') {
        styleSunburstNodesAdvanced(data); 
    } else { 
        console.warn("chroma.js not loaded, using simpler sunburst colors for sunburst chart.");
        // Fallback to simpler coloring if chroma.js is not available
        (function simpleColor(nodes, level=0){
            nodes.forEach((n,idx)=>{
                n.itemStyle = n.itemStyle || {};
                n.label = n.label || {};
                if(level===0 && n.name.startsWith('模式')){ 
                    const mi=parseInt(n.name.replace('模式','')); 
                    n.itemStyle.color=modeColors[mi%modeColors.length];
                    n.label={fontSize:15,fontWeight:'bold',color:'#fff'};
                }
                else if(level===1){ // 分数段
                    const baseColor = (n.parent && n.parent.itemStyle && n.parent.itemStyle.color) ? n.parent.itemStyle.color : modeColors[0];
                    n.itemStyle.color=chroma(baseColor).brighten(1 + idx*0.2).hex(); 
                    n.label={fontSize:12};
                } 
                else if(level===2){ // 知识点
                     const baseColor = (n.parent && n.parent.itemStyle && n.parent.itemStyle.color) ? n.parent.itemStyle.color : modeColors[1];
                    n.itemStyle.color=chroma(baseColor).darken(0.5 + idx*0.1).hex(); 
                    n.label={fontSize:10};
                }
                if(n.children) simpleColor(n.children, level+1);
            });
        })(data);
    }

    const sunburstChart = echarts.init(sunburstEl);
    const sbOption = {
        title: { text: '模式-分数段-Top5知识点偏好', left: 'center', top: '2%', textStyle: {fontSize: 18, fontWeight:'500', color: '#2c3e50'}},
        tooltip: { 
            formatter: function(params){ 
                let path = params.treePathInfo.map(item => item.name).join(' > ');
                return `${params.marker}${path}<br/>数量: <b>${params.value}</b> (占父级 ${params.percent}%)`;
            } 
        },
        series: {
            type: 'sunburst', data: data, radius: ['8%', '94%'], center: ['50%', '54%'], // 调整半径和中心
            label: { 
                rotate: 'radial', // 径向旋转标签
                minAngle: 4,    // 角度小于此值时不显示标签，避免过于拥挤
                overflow: 'truncate', 
                ellipsis: '..', 
                formatter: function(params){ 
                     // 叶子节点且值较小，或者非叶子节点但空间不足时，简化或不显示标签
                    if (params.treePathInfo.length > 2 && params.value < 10 && params.name.length > 5) return ''; 
                    if (params.treePathInfo.length === 2 && params.name.length > 6) return params.name.substring(0,5) + '..'; // 分数段名称截断
                    if (params.treePathInfo.length > 2 && params.name.length > 8) return params.name.substring(0,7) + '..'; // 知识点名称截断
                    return params.name; 
                }
            },
            itemStyle: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 4 }, // 扇区样式
            levels: [ 
                {}, // 最外层，通常是虚拟根节点，这里我们没有
                { r0: '8%', r: '38%', itemStyle:{borderWidth:3, shadowBlur:5, shadowColor:'rgba(0,0,0,0.2)'}, label:{fontSize:15, padding:3, color: '#fff'}}, // 模式层
                { r0: '38%', r: '68%', itemStyle:{borderWidth:2}, label:{fontSize:12, padding:3, align:'center'}}, // 分数段层
                { r0: '68%', r: '94%', label:{position:'outside', padding:2, silent:false, fontSize:10, color:'#454545', distanceToLabelLine: 3}, itemStyle:{borderWidth:1} } // 知识点层
            ],
            emphasis: { 
                focus: 'ancestor', // 高亮祖先和自身
                label:{show:true, fontWeight:'bold'},
                itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.4)'}
            },
            nodeClick: 'rootToNode', 
            sort: function(a,b){ return b.value - a.value; } // 按值降序排列同层节点
        }
    };
    sunburstChart.setOption(sbOption);
  }).catch(error => console.error("Error fetching sunburst data:", error));   

window.addEventListener('resize', () => {
    const chartIdsToResize = [ // 定义一个包含所有图表ID的数组
      'scatterChart', 'heatmapChart', 'sankeyChart', 'parallelSingleChart',  
      'barProfileChart', 'radar_chart_1', 'radar_chart_2', 'radar_chart_3',
      'knowledgeMasteryHeatmapChart', 'radialBarKnowledgeChart', 
      'sunburstPreferenceChart',  'themeRiverChart'
    ];
    chartIdsToResize.forEach(id => { // 对这个数组进行forEach
      const dom = document.getElementById(id);
      if (dom) {
        const chartInstance = echarts.getInstanceByDom(dom);
        if (chartInstance) {
          try {
            chartInstance.resize();
          } catch (e) {
            console.warn(`Error resizing chart with id ${id}:`, e);
          }
        }
      }
    });
  }); // 正确闭合 addEventListener 的回调和调用