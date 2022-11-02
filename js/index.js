// 所有处理过的原始数据
var allHandledData = {}

// 缓存图片数据源
var imgViewMap = {}

// 所有子节点数据 key：connectTo value: 相同connectTo的所有数据数组
var childData = {}

// 未展开节点数据集合
var expandeds = new Array()

// 中间节点id
var centerDataId = ""

var dataModels = []

var globalWidth

var globalHeight

var _g_nodes

var _g_lines
/**
 * 默认展示容器参数
 * container: 别名
 * width: 容器宽
 * height：容器高
 */
var tpOption = {
    container: '#tpContainer',
    width: window.innerWidth || document.documentElement.clientWidth,
    height: window.innerHeight || document.documentElement.innerHeight
}

/**
 * Topology初始化
 * @param option 初始化参数
 */
function Topology(option) {
    var _defaultOption = {
        width: 300,
        height: 300,
        data: '',
        container: ''
    }

    // 把属性挂载到TPChart的原型上
    option = $.extend(true, _defaultOption, option)
    this.width = option.width
    this.height = option.height
    this.data = option.data //数据url或对象,必填
    this.container = option.container //svg容器(node或者选择器)，必填

    var w = this.width,
        h = this.height,
        self = this

        globalWidth = w;
        globalHeight = h;

    this.force = d3.layout.force().gravity(0.05).linkDistance(function (d) {
        var source = d.source
        var target = d.target
        //未展开子节点与其子节点间距
        if (!source._expanded & isExpandeds(target)) {
            return 80
        }
        if (!source._expanded) {
            return 40
        }
        var distance = 100
        distance += distance * Math.random() * 0.5
        return distance
    }).charge(function (d) {
        //未展开子节点中其子节点大小
        if (!isExpandeds(d)) {
            return -600
        }
        return -1200
    })
    .size([w, h])
    .start()

    _g_nodes = this.force.nodes()

    this.nodes = this.force.nodes()
    this.links = this.force.links()

    this.vsg = d3.select(this.container)
                    .append("svg:svg")
                    .attr("width", w)
                    .attr("height", h)
                    .attr("pointer-events", "all")
    this.graph = this.vsg.append("g").attr("class", "graph")

    //添加缩放行为
    this.vsg.call(getZoomBehavior(this.graph))
}

/**
 * 添加缩放行为
 * @param d: 缩放区域
 * @returns {*|number[]|undefined} 缩放数据
 */
function getZoomBehavior(d) {
    return d3.behavior.zoom().scaleExtent([0.3, 5]).on("zoom", zoomEvtFn)

    function zoomEvtFn() {
        d.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")")
    }
}

/**
 *添加拖动行为
 * @param force: 拖动区域
 * @returns {*|undefined} 拖动数据
 */
function getDragBehavior(force) {

    return d3.behavior.drag()
        .origin(function (d) {
            return d
        })
        .on("dragstart", dragstart)
        .on("drag", dragging)
        .on("dragend", dragend)

    function dragstart(d) {
        d3.event.sourceEvent.stopPropagation()
        d3.select(this).classed("dragging", true)
        force.start()
    }

    function dragging(d) {

        var tempX = d3.event.x;
        // 控制拖动范围
        // if (tempX + getNodeImageSize(d) > globalWidth) {
        //     tempX = globalWidth - getNodeImageSize(d) / 2
        // }

        // if (tempX <= getNodeImageSize(d) / 2) {
        //     tempX = getNodeImageSize(d) / 2
        // }

        var tempY = d3.event.y
        // if (tempY + getNodeImageSize(d) + 20 > globalHeight) {
        //     tempY = globalHeight - getNodeImageSize(d)
        // }

        // if (tempY <= getNodeImageSize(d) / 2) {
        //     tempY = getNodeImageSize(d) / 2
        // }

        d.x = tempX
        d.y = tempY
    }

    function dragend(d) {
        d3.select(this).classed("dragging", false)
    }
}

/**
 * 增加节点
 * @param nodes: 节点数据数组
 */
Topology.prototype.addNodes = function (nodes) {
    if (Object.prototype.toString.call(nodes) == '[object Array]') {
        var self = this
        nodes.forEach(function (node) {
            self.addNode(node)
        })
    }
}
Topology.prototype.addNode = function (node) {
    this.nodes.push(node)
}

/**
 * 增加连线
 * @param links: 节点之间连线数据数组
 */
Topology.prototype.addLinks = function (links) {
    if (Object.prototype.toString.call(links) == '[object Array]') {
        var self = this
        links.forEach(function (link) {
            self.addLink(link['source'], link['target'])
        })
    }
}
Topology.prototype.addLink = function (source, target) {
    this.links.push({
        source: this.findNode(source),
        target: this.findNode(target)
    })
}
/**
 * 删除节点
 * @param id: 需要删除节点id
 */
Topology.prototype.removeNode = function (id) {
    var i = 0,
        n = this.findNode(id),
        links = this.links
    while (i < links.length) {
        links[i]['source'] == n || links[i]['target'] == n ? links.splice(i, 1) : ++i
    }
    if (id != centerDataId) {
        var removeNode = self.findNodeIndex(id)
        if (removeNode != "-1") {
            this.nodes.splice(removeNode, 1)
        }
    }
}
Topology.prototype.removeChildNodes = function (id) {
    var node = this.findNode(id),
        nodes = this.nodes
    links = this.links,
        self = this

    var linksToDelete = [],
        childNodes = []

    links.forEach(function (link, index) {
        link['source'] == node
        && linksToDelete.push(index)
        && childNodes.push(link['target'])
    })

    linksToDelete.reverse().forEach(function (index) {
        links.splice(index, 1)
    })

    var remove = function (node) {
        var length = links.length
        for (var i = length - 1; i >= 0; i--) {
            if (links[i] != null && links[i]['source'] == node) {
                var target = links[i]['target']
                links.splice(i, 1)
                if (node.id != centerDataId) {
                    var removeNode = self.findNodeIndex(node.id)
                    if (removeNode != "-1") {
                        nodes.splice(removeNode, 1)
                    }
                }
                remove(target)

            }
        }
    }

    childNodes.forEach(function (node) {
        remove(node)
    })

    //清除没有连线的节点
    for (var i = nodes.length - 1; i >= 0; i--) {
        var haveFoundNode = false
        for (var j = 0, l = links.length; j < l; j++) {
            (links[j]['source'] == nodes[i] || links[j]['target'] == nodes[i]) && (haveFoundNode = true)
        }
        if (nodes[i].id != centerDataId) {
            !haveFoundNode && nodes.splice(i, 1)
        }
    }
}

/**
 * 节点信息数据数量变动更新界面
 */
Topology.prototype.update = function () {

    var lineNode = this.graph.selectAll("line.line")
        .data(this.links, function (d) {
            console.log(d.target)
            return d.source.id + "-" + d.target.id
        })
        .attr("class", function (d) {
            return 'link'
        })

    _g_lines = lineNode.enter().insert('g', "g.node")
    var linkLine = _g_lines.append("svg:line")
    setLinkLine(linkLine)

    _g_lines.each(function (d, i) {
            if (isExtender(d.target)) {
                var _this = d3.select(this)
                _this.append("image")
                    // .attr("xlink:href", function (d) {
                    //     if (isExtender(d.target)) {
                    //         return 'img/clouds/link_arrow.png'
                    //     }
                    // })
                    .attr("visibility", function (d) {
                        return 'hidden'
                    })

                _this.append("image")
                    // .attr("xlink:href", function (d) {
                    //     if (isExtender(d.target) && isExtender(d.source)) {
                    //         return 'img/clouds/link_arrow.png'
                    //     }
                    // })
                    .attr("visibility", function (d) {
                        return 'hidden'
                    })
            }
    })


    lineNode.exit().remove()


    var node = this.graph.selectAll("g.node")
        .data(this.nodes, function (d) {
            return d.id
        })

    var nodeEnter = node.enter().append("svg:g")
        .attr("class", "node")
        .call(this.force.drag)

    //添加拖拽行为
    nodeEnter.call(getDragBehavior(this.force))

    // let circle = nodeEnter.append("svg:circle")
    // setNodeCircle(circle)

    //增加图片

    setNodeLinearStroke(nodeEnter)

    nodeEnter.append("svg:image")
        .attr("x", function (d) {
            return -getNodeImageSize(d) / 2
        })
        .attr("y", function (d) {
            return -getNodeImageSize(d) / 2
        })
        .attr("width", function (d) {
            return getNodeImageSize(d)
        })
        .attr("height", function (d) {
            return getNodeImageSize(d)
        })
        .attr("rx", function (d) {
            return getNodeImageSize(d) / 2
        })
        .attr("xlink:href", function (d) {

            var device_type;
            if (d.deviceType == "hitron") {
                device_type = "gateway_" + allHandledData.networkModelImageName
            } else {
                device_type = "device_type_" + d.deviceType
            }

            // var device_type = "device_type_" + d.deviceType
            // if (d.status == "Offline") {
            //     device_type += "_offline"
            // }
            // if (!isExpandeds(d)) { // 未展开的灰色圆点
            //     device_type = "normal_device";
            // }
            return getImage(device_type)
        })
        .on('click', function (node) {
            nodeClick(node, true)
        })


    // 添加name
    nodeEnter.append("svg:text")
        .attr("class", "hostNameText")
        .attr("x", function (d) {
            return 0
        })
        .attr("y", function (d) {
            return getNodeImageSize(d) / 2 + 18
        })
        .attr('overflow', 'hidden')
        .text(function (d) {
            var name = getHostName(d)
            var bytesCount = 0;
            for (var i = 0; i < name.length; i++) {
                var c = name.charAt(i);
                if (/^[\u0000-\u00ff]$/.test(c)) { // 匹配双字节
                    bytesCount += 1;
                } else {
                    bytesCount += 2;
                }
                if (bytesCount >= 20) {
                    // 限制文本显示最大长度为 20 个字节
                    name = name.slice(0, i-1) + '...'
                    break;
                }
            }
            return name
        })
        .style('text-overflow', 'ellipsis')
        .style('white-space', 'nowrap')
        .style('font-size', '14')
        .style('font-weight', '500')
        .style('font-family', 'Helvetica')
        .style('fill', themeGrayColor) // 文字颜色
        .attr("text-anchor", "middle") // 文字居中
        .attr("dominant-baseline", "middle") // 文字居中
        .call(getBB)

    // 插入文本背景色
    nodeEnter.insert("svg:rect", "text")
        .attr("class", "textBgRect")
        .attr("x", function (d) {
            return d.bbox.x - 8
        })
        .attr("y", function (d) {
            return d.bbox.y - 2
        })
        .attr("outline", "none")
        .attr("width", function(d){return d.bbox.width + 16})
        .attr("height", function(d){return d.bbox.height + 4})
        .attr("rx", function(d){return d.bbox.height/1.5})
        .style("fill", "white")
        .attr("visibility", function (d) {
            if (isExpandeds(d)) {
                return "visible"
            }
            return "hidden"
        })

    // 添加数字角标
    setBadgeNum(nodeEnter);

    nodeEnter.each(function (d, i) {
        var selection = d3.select(this)
        var img = getStatuImg(d)

        selection.append("g").attr("class", "status_tip")
            .append("image")
            .attr("transform", function (d) {
                var width = parseFloat(16)
                return 'translate(' + 0.8 * width + ', -23)'
            })
            .attr("width", 16)
            .attr("height", 16)
            .attr("xlink:href", function (d) {
                return img
            })
            .attr("visibility", function (d) {
                if (isExpandeds(d)) {
                    return "hidden"
                }
                return "hidden"
            })
            .on('click', function (node) {
                nodeClick(node, true)
            })

    })

    node.exit().remove()
    this.force.start()
    updateNodeFrame()
}

/**
 * 返回 text 的 size
 */
function getBB(selection) {
    selection.each(function(d){ 
        d.bbox = this.getBBox();
        // d.bbox.width = d.bbox.width > getNodeImageSize(d) * 2 ? getNodeImageSize(d) * 2 : d.bbox.width;
        // d.bbox.x = -d.bbox.width/2;
    })
}

/**
 * 添加渐变色描边
 */
function setNodeLinearStroke(nodeEnter) {
    const defs = nodeEnter.append('defs')
    const l1 = defs.append('linearGradient')
        .attr('id', 'grd1')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%')

    l1.append('stop')
        .attr("offset", '0%')
        .attr('stop-color', '#00A3E0')

    l1.append('stop')
        .attr("offset", '100%')
        .attr("stop-color", '#004C97')

    nodeEnter.append('circle')
        .attr("id", "imageBgCircle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", function (d) {
            if (d.deviceType == "hitron") {
                return getNodeImageSize(d) / 2 + 3
            }
            return 0
        })
        .attr('fill', 'url(#grd1)')

    nodeEnter.append('circle')
        .attr("id", "imageBgCircle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", function (d) {
            return getNodeImageSize(d) / 2
        })
        .attr('fill', function(d){
            // if (isHostExtenderType(d) && d.status == "Offline") {
            //     return themeLightGrayColor
            // }
            return 'white'
        })
}

/**
 * 添加节点右上角角标
 * 
 */
 function setBadgeNum(nodeEnter) {
    // 添加角标背景
    nodeEnter.append("circle")
        .attr("class", "badgeView")
        .attr("transform", function (d) {
            var width = parseFloat(getNodeImageSize(d)/2.5)
            return 'translate(' + width * (getNodeImageSize(d) / 60) + ',' + (-width) + ')'
        })
        .attr("r", 15)
        .style("fill", themeMinorColor["Hitron"])
        .style("stroke", "white")
        .style("stroke-width", "2")
        .attr("visibility", function (d) {
            // 只有 gateway / extender 才会显示数字角标
            let count = getConnectedDevicesNum(dataModels, d)
                if (count > 0 && d._expanded == false && isExtender(d)) {
                    return "visible"
                }
            return "hidden"
        })
        

    // 添加角标数字
    nodeEnter.append("text")
        .attr("class", "badgeView")
        .attr("transform", function (d) {
            var width = parseFloat(getNodeImageSize(d)/2.5)
            return 'translate(' + width * (getNodeImageSize(d) / 60) + ',' + (-width + 1) + ')'
        })
        .text(function (d) {
            let count = getConnectedDevicesNum(dataModels, d)
            return count
        })
        .attr("width", 22)
        .attr("height", 22)
        .style("fill", "white")
        .style('font-size', '16')
        .style('font-weight', 500)
        .style('font-family', 'Helvetica')
        .attr("text-anchor", "middle") // 文字居中
        .attr("dominant-baseline", "middle") // 文字居中
        .attr("visibility", function (d) {

            // 只有 gateway / extender 才会显示数字角标
            let count = getConnectedDevicesNum(dataModels, d)
                if (count > 0 && d._expanded == false && isExtender(d)) {
                    return "visible"
                }

            return "hidden"
        })
}

/**
 * 更新已有节点信息
 */
Topology.prototype.refresh = function () {

    let line = _g_lines.selectAll('line')
    setLinkLine(line)

    let node = this.graph.selectAll("g.node")
        .data(this.nodes, function (d) {
            return d.id
        })

    // let circle = node.selectAll("circle")
    // setNodeCircle(circle)


    let nodeImages = node.selectAll('image')

    var resultNodeImages = []
    var resultStatuImages = []

    resultNodeImages.__proto__ = nodeImages.__proto__
    resultStatuImages.__proto__ = nodeImages.__proto__

    for (var i = 0; i < nodeImages.length; i++) {
        var item = nodeImages[i]
        if (item.length == 0) {
            continue
        }
        var nodeImg = []
        nodeImg[0] = item[0]
        nodeImg.parentNode = item.parentNode
        resultNodeImages[resultNodeImages.length] = nodeImg

        if (item.length == 1) {
            continue
        }
        var statuImg = []
        statuImg[0] = item[1]
        statuImg.parentNode = item.parentNode
        resultStatuImages[resultStatuImages.length] = statuImg
    }

    resultNodeImages
        .attr("x", function (d) {
            return -getNodeImageSize(d) / 2
        })
        .attr("y", function (d) {
            return -getNodeImageSize(d) / 2
        })
        .attr("width", function (d) {
            if (!isExpandeds(d)) {
                return 0
            }
            return getNodeImageSize(d)
        })
        .attr("height", function (d) {
            return getNodeImageSize(d)
        })
        .attr("xlink:href", function (d) {
            var device_type = "device_type_0";
            if (d.deviceType == "hitron") {
                device_type = "gateway_" + allHandledData.networkModelImageName
            } else {
                device_type = "device_type_" + d.deviceType
            }
            return getImage(device_type)
        })

    resultStatuImages
        .attr("visibility", function (d) {
            if (isExpandeds(d)) {
                return "hidden"
            }
            return "hidden"
        })

    node.selectAll('#imageBgCircle')
        .attr("visibility", function (d) {
            if (isExpandeds(d)) {
                return "visible"
            }
            return "hidden"
        })

    node.selectAll('.hostNameText')
    .attr("x", function (d) {
        return 0
    })
    .attr("y", function (d) {
        return getNodeImageSize(d) / 2 + 18
    })
    .text(function (d) {
        return getHostName(d)
    })
    .call(getBB)


    node.selectAll('.textBgRect')
    .attr("x", function (d) {
        return -d.bbox.width / 2 - d.bbox.height/2
    })
    .attr("y", function (d) {
        return getNodeImageSize(d) / 2 + 8
    })
    .attr("width", function(d){return d.bbox.width + 16})
    .attr("height", function(d){return d.bbox.height + 4})
    .attr("rx", function(d){return d.bbox.height/1.5})
    .style("fill", "white")
    .attr("visibility", function (d) {
        if (isExpandeds(d)) {
            return "visible"
        }
        return "hidden"
    })

    node.selectAll('.badgeView')
        .attr("visibility", function (d) {
            let count = getConnectedDevicesNum(dataModels, d)
            if (count > 0 && d._expanded == false) {
                return "visible"
            }
            return "hidden"
        })

    node.exit().remove()
    this.force.start()
    updateNodeFrame()
}


function setNodeCircle(circle) {
    circle
        .attr("cx", function (d) {
            return -getNodeImageSize(d) / 2
        })
        .attr("cy", function (d) {
            return -getNodeImageSize(d) / 2
        })
        .attr("r", function (d) {
            return 5
        })
        .attr("visibility", function (d) {
            if (isExpandeds(d)) {
                return "hidden"
            }
            return "visiable"
        })
        .attr("fill", function (d) {
            if (d.status == "Offline") {
                return themeLightGrayColor
            }
            return themeMainColor['Hitron']
        })
}

function setLinkLine(link) {
    link.style('stroke',
        function (d) {
            var target = d.target
            if (target.status == "Offline") {
                return themeLightGrayColor
            }
            // return themeMinorColor['Hitron']
            // band
            var connectType = target.connectType
            if (parseInt(connectType) == 1) { //2.4G
                return statesYellowColor
            }
            return themeMinorColor['Hitron']
        },)
        .style("stroke-dasharray", function (d) {
            var target = d.target
            if (target == null) {
                return ''
            }
            // if (!isExpandeds(target)) {
            //     return ''
            // }

            if (target.status == "Offline") {
                return '1.5, 5'
            }
            // if (isExtender(target)) {
            //     return ''
            // }

            // band
            var connectType = target.connectType
            switch (connectType) {
                case '1': // 2.4G -> dotted line
                    return '1.5, 5'
                case '2': // 5G -> dotted line
                    return '5, 5'
                case '7': // 6G -> dash line
                    return '5, 5'
                case '3': // ethernet -> solid line
                    return ''
                default:
                    return ''
            }
        })
        // 人物节点之间连接线的粗细通过连接线的value字段来计算，value越大，连接线
        .style("stroke-width", function (d) {
            var target = d.target
            if (isExtender(target)) {
                return 3
            }
            if (isExpandeds(target)) {
                return 2
            }
            return 0
        })
}


/**
 * 修改节点连线
 * @param macAddr 要修改的节点地址
 * @param connectTo 节点的指向地址
 */
function changeNodeConnectTo(macAddr, connectTo) {
    macAddr = macAddr.toLowerCase()
    connectTo = connectTo.toLowerCase()

    // childData
    var changeData = null
    var connectToNode = null

    for (var i = 0; i < topology.nodes.length; i++) {
        var node = topology.nodes[i]
        if (node.macAddr == connectTo) {
            connectToNode = node
            break
        }
    }
    if (connectToNode == null) {
        return
    }

    for (var i = 0; i < topology.links.length; i++) {
        var changeLine = topology.links[i]
        if (changeLine.target.macAddr == macAddr) {
            changeData = changeLine.target
            if (connectToNode != null) {
                changeLine.source = connectToNode
                break
            }
        }
    }

    if (changeData == null) {
        return
    }
    changeData.connectTo = connectTo
    if (changeData.groupMaster != "YES") {
        changeData.groupId = childData[connectTo].groupId
    }

    topology.refresh()

}

/**
 * 动态更新节点坐标
 */
function updateNodeFrame() {
    // d3.forceCenter([200, 200])
    topology.force.on("tick", function (x) {

        // 固定中心点位置
        // _g_nodes[0].x = globalWidth / 2;
        // _g_nodes[0].y = globalHeight / 2;
        
        topology.graph.selectAll("g.node")
            // .attr("cx", function(d) { 
            //     return d.x = Math.max(getNodeImageSize(d), Math.min(globalWidth - getNodeImageSize(d), d.x)); }) // 限制最大拖动范围
            // .attr("cy", function(d) { 
            //     return d.y = Math.max(getNodeImageSize(d), Math.min(globalHeight - getNodeImageSize(d), d.y)); // 限制最大拖动范围
            //  })
             .attr("transform", function (d) {
                return "translate(" + d.x + "," + d.y + ")"
            })

        _g_lines.select("line")
            .attr("x1", function (d) {
                return d.source.x
            })
            .attr("y1", function (d) {
                return d.source.y
            })
            .attr("x2", function (d) {
                return d.target.x
            })
            .attr("y2", function (d) {
                return d.target.y
            })

        let linkImages = _g_lines.selectAll('image')

        var sourceImages = []
        var targetImages = []

        sourceImages.__proto__ = linkImages.__proto__
        targetImages.__proto__ = linkImages.__proto__

        for (var i = 0; i < linkImages.length; i++) {
            var item = linkImages[i]
            if (item.length == 0) {
                continue
            }
            var sourceImg = []
            sourceImg[0] = item[0]
            sourceImg.parentNode = item.parentNode
            sourceImages[sourceImages.length] = sourceImg

            if (item.length == 1) {
                continue
            }
            var targetImg = []
            targetImg[0] = item[1]
            targetImg.parentNode = item.parentNode
            targetImages[targetImages.length] = targetImg
        }


        let imgSize = 28
        let sourceImgDistance = 21.5
        sourceImages
            .attr('x', function (d) {
                let starPoint = {'x': d.source.x, 'y': d.source.y}
                let endPoint = {'x': d.target.x, 'y': d.target.y}
                let r = getNodeImageSize(d.source) / 2 - sourceImgDistance
                let point = getLeastPointOnCircleAndLine(endPoint.x, endPoint.y, starPoint.x, starPoint.y, r)
                if (point == null) return 0
                return point.x
            })
            .attr('y', function (d) {
                if (d.connectTo == "hitron") return 300 / 2;
                let starPoint = {'x': d.source.x, 'y': d.source.y}
                let endPoint = {'x': d.target.x, 'y': d.target.y}
                let r = getNodeImageSize(d.source) / 2 - sourceImgDistance
                let point = getLeastPointOnCircleAndLine(endPoint.x, endPoint.y, starPoint.x, starPoint.y, r)
                if (point == null) return 0
                return point.y
            })
            .attr('width', imgSize)
            .attr('height', imgSize)
            .attr("transform", function (d) {
                let starPoint = {'x': d.source.x, 'y': d.source.y}
                let endPoint = {'x': d.target.x, 'y': d.target.y}
                let r = getNodeImageSize(d.source) / 2 - sourceImgDistance
                let point = getLeastPointOnCircleAndLine(endPoint.x, endPoint.y, starPoint.x, starPoint.y, r)

                var x1 = d.source.x,
                    x2 = d.target.x,
                    y1 = d.source.y,
                    y2 = d.target.y,
                    rightAngleSide1 = Math.abs(y2 - y1),
                    rightAngleSide2 = Math.abs(x2 - x1),
                    _asin = 0,
                    _rotateAngle = 0

                if (x1 < x2) {
                    _asin = (y2 - y1) / Math.sqrt(Math.pow(rightAngleSide1, 2) + Math.pow(
                        rightAngleSide2, 2))
                    _rotateAngle = (Math.asin(_asin) * 180 - 140) / Math.PI
                } else {
                    _asin = (y1 - y2) / Math.sqrt(Math.pow(rightAngleSide1, 2) + Math.pow(
                        rightAngleSide2, 2))
                    _rotateAngle = (Math.asin(_asin) * 180 - 140) / Math.PI
                    _rotateAngle = _rotateAngle < 0 ? (180 + _rotateAngle) : -(180 -
                        _rotateAngle)
                }
                return 'rotate(' + (_rotateAngle) + ',' + point.x + ' ' + point.y + ')' //以线段的三分之一出为旋转焦点
            }
            )
            .attr("visibility", function (d) {
                return "visible"
            })


        var targetImgDistance = sourceImgDistance
        var expertDistance = -14
        targetImages
            .attr('x', function (d) {
                let endPoint = {'x': d.source.x, 'y': d.source.y}
                let starPoint = {'x': d.target.x, 'y': d.target.y}
                let r = getNodeImageSize(d.source) / 2 - targetImgDistance
                if (d.source._expanded) {
                    r += expertDistance
                }
                let point = getLeastPointOnCircleAndLine(endPoint.x, endPoint.y, starPoint.x, starPoint.y, r)
                if (point == null) return 0
                return point.x
            })
            .attr('y', function (d) {
                let endPoint = {'x': d.source.x, 'y': d.source.y}
                let starPoint = {'x': d.target.x, 'y': d.target.y}
                let r = getNodeImageSize(d.source) / 2 - targetImgDistance
                if (d.source._expanded) {
                    r += expertDistance
                }
                let point = getLeastPointOnCircleAndLine(endPoint.x, endPoint.y, starPoint.x, starPoint.y, r)
                if (point == null) return 0
                return point.y
            })
            .attr('width', imgSize)
            .attr('height', imgSize)
            .attr("transform", function (d) {
                let endPoint = {'x': d.source.x, 'y': d.source.y}
                let starPoint = {'x': d.target.x, 'y': d.target.y}
                let r = getNodeImageSize(d.source) / 2 - targetImgDistance
                if (d.source._expanded) {
                    r += expertDistance
                }
                let point = getLeastPointOnCircleAndLine(endPoint.x, endPoint.y, starPoint.x, starPoint.y, r)

                var x1 = d.source.x,
                    x2 = d.target.x,
                    y1 = d.source.y,
                    y2 = d.target.y,
                    rightAngleSide1 = Math.abs(y2 - y1),
                    rightAngleSide2 = Math.abs(x2 - x1),
                    _asin = 0,
                    _rotateAngle = 0

                if (x1 < x2) {
                    _asin = (y2 - y1) / Math.sqrt(Math.pow(rightAngleSide1, 2) + Math.pow(
                        rightAngleSide2, 2))
                    _rotateAngle = (Math.asin(_asin) * 180 + 420) / Math.PI
                } else {
                    _asin = (y1 - y2) / Math.sqrt(Math.pow(rightAngleSide1, 2) + Math.pow(
                        rightAngleSide2, 2))
                    _rotateAngle = (Math.asin(_asin) * 180 + 420) / Math.PI
                    _rotateAngle = _rotateAngle < 0 ? (180 + _rotateAngle) : -(180 -
                        _rotateAngle)
                }
                return 'rotate(' + (_rotateAngle) + ',' + point.x + ' ' + point.y + ')' //以线段的三分之一出为旋转焦点
            })
            .attr("visibility", function (d) {
                return "visible"
            })


    })
}

/**
 * 节点点击
 * @param node 节点信息
 * @param needUpdate 是否需要更新节点点击状态和点击事件传递
 */
function nodeClick(node, needUpdate) {
    var macAddr = node['macAddr']
    if (needUpdate) {
        if (!node['_expanded']) {
            if (childData[node.id] != null && childData[node.id].nodes.length > 0) {

                // expandNode(childData, node.id)
                node['_expanded'] = true
                expandeds[expandeds.length] = macAddr
            }
        } else {
            // collapseNode(node.id)
            node['_expanded'] = false
            var index = expandeds.indexOf(macAddr)
            expandeds.splice(index, 1)
        }

        if (isExpandeds(node)) {
            var nodeStr = JSON.stringify(node)
            var data = {}
            data.clickNode = nodeStr;
            var message = JSON.stringify(data)

            try {
                window.parent.postMessage(message)
            } catch (e) {
                console.log("window Is Null")
            }

            try {
                NodeClickListener.postMessage(message)
            } catch (e) {
                console.log("NodeClickListenner Not Set")
            }
        }
    }
    if (childData[node.macAddr] != null) {
        topology.refresh()
    }
}

/**
 * 查找节点
 * @param id 节点id
 * @returns {null|*} 节点
 */
Topology.prototype.findNode = function (id) {
    var nodes = this.nodes
    for (var i in nodes) {
        if (nodes[i]['id'] == id) return nodes[i]
    }
    return null
}

/**
 * 查找节点所在索引号
 * @param id 节点id
 * @returns {string|number} 节点数据所在所有数据中的位置
 */
Topology.prototype.findNodeIndex = function (id) {
    var nodes = this.nodes
    for (var i in nodes) {
        if (nodes[i]['id'] == id) return i
    }
    return -1
}

/**
 * 初始化Topology
 * @type {Topology} 初始化之后的topology
 */
var topology = new Topology(tpOption)

/**
 * 点击节点展开其子节点
 * @param childData 所有子节点的数据
 * @param node 点击节点的数据
 */
function expandNode(childData, node) {
    var id = node.id
    var childDatas = childData[id]
    var childNodes = childDatas.nodes
    var childLinks = childDatas.lines
    topology.addNodes(childNodes)
    topology.addLinks(childLinks)


    for (var i = 0; i < childNodes.length; i++) {
        var updateNode = childNodes[i]
        var data = childData[updateNode.id]
        if (data != null) {
            nodeClick(updateNode, false)
            // return
        }
    }
    topology.update()

}

/**
 * 删除节点
 * @param id 节点id
 */
function collapseNode(id) {
    topology.removeChildNodes(id)
    topology.update()
}

/**
 * 获取展示数据
 */
setRequestData()

function setRequestData() {


    var authorization = findHeader('Authorization')
    if (authorization == null || authorization.length == 0) {
        authorization = "Bearer " +  findGetParameter("token")
    }
    var mac = findGetParameter("mac")
    var oauth = findGetParameter("oauth")
    var showExample = findGetParameter("show_example")
    var showExample2 = findGetParameter("show_example2")


    let urlHeader = 'http://172.28.31.210:9000/api'

    var url =  "test.json"//urlHeader + "/1/Device/" + mac + "/Hosts"
//    if (oauth == 'net') {
//        url = urlHeader + "/1/Device/" + mac + "/Hosts"
//    }
    // if (showExample) {
    //     url = "test.json"
    // }
    // if (showExample2) {
    //     url = "test2.json"
    // }

    var header = {}
    header.Authorization = authorization

//    url = 'https://oauth.hitroncloud.com/oauth2/auth?audience=&client_id=app-2Y6FnS5YjP3GbQdGhzVjyWUztc&max_age=0&nonce=lsxwtpewpgwdcrjgrbwhgzxz&redirect_uri=myhitron://oauth2Callback&response_type=code&scope=offline+openid&state=nbhjacofihqbgyzlgwqweuzr&prompt=login'
    ajax(url, header, function (d) {
        var temp = JSON.parse(d)
        var jsonData = handleAllData(temp)
        var hostList = jsonData.Hosts_List
        // if (hostList == null) {
        //     return
        // }
        dataModels = hostList
        setTpData()
    }, 'GET')
}

/**
 * Topology数据赋值
 */
function setTpData() {
    // if (dataModels.length == 0) {
    //     return;
    // }
    var data = formatHostsData(dataModels)
    var nodes = data.nodes
    topology.addNodes(nodes)
    topology.addLinks(data.lines)
    topology.update()
}

/**
 * 获取访问地址中的参数
 * @param parameterName 参数名
 * @returns {null} 参数名对应的值
 */
function findGetParameter(parameterName) {
    var result = null,
        tmp = []
    location.search
        .substr(1)
        .split("&")
        .forEach(function (item) {
            tmp = item.split("=")
            if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1])
        })
    return result
}

function findHeader(parameterName) {
    var req = new XMLHttpRequest();
    req.open('GET', document.location.href, false);
    req.send(null);
    var headerArr = req.getAllResponseHeaders().split('\n');
    var headers = {};
    headerArr.forEach(item=>{
        if(item!==''){
            var index = item.indexOf(':');
            var key = item.slice(0,index);
            var value = item.slice(index+1).trim();
            headers[key] = value
        }
    })
    return headers[parameterName];
}

/**
 * 数据请求
 * @param url 请求地址
 * @param headers 请求头
 * @param dataCallback 请求返回值
 * @param method 请求类型 "GET" "POST"
 * @param postBody 请求参数
 * @param aSync 是否异步请求
 * @param timeoutCallback 请求超时返回
 * @param errorCallback 请求出错返回
 * @param abortCallback 请求中止返回
 */
function ajax(url, headers, dataCallback, method, postBody, aSync, timeoutCallback, errorCallback, abortCallback) {

    if (method == undefined) {
        method = "GET"
    } else {
        method = method.toUpperCase()
    }
    if (!aSync) {
        aSync = true
    }
    if (!headers) {
        headers = {}
    }

    var rqst = getRequestObj()
    if (rqst) {

        rqst.onreadystatechange = function () {
            if (this.readyState === 302) {
                console.log(this.responseURL);
            }
            if (rqst.readyState == 4) {
                if (dataCallback) {
                    dataCallback(rqst.responseText, rqst.readyState)
                }
            }
        }
        rqst.ontimeout = function () {
            if (timeoutCallback) {
                timeoutCallback()
            }
        }
        rqst.onerror = function () {
            if (errorCallback) {
                errorCallback()
            }
        }
        rqst.onabort = function () {
            if (abortCallback) {
                abortCallback()
            }
        }

        rqst.open(method, url, aSync)
        for (key in headers) {
            rqst.setRequestHeader(key, headers[key])
        }

        if (method == "POST") {
            rqst.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
        }

        rqst.send(postBody)
    }

    function getRequestObj() {
        if (window.ActiveXObject) {
            return new ActiveXObject('Microsoft.XMLHTTP')
        } else if (window.XMLHttpRequest) {
            return new XMLHttpRequest()
        }
    }
}

