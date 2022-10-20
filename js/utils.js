/**
 * 获取节点显示名
 * @param d 节点数据
 * @returns {string} 显示的内容
 */
 function getHostName(d) {
    if (d._expanded) {
        return d.hostName
    }
    if (expandeds.includes(d.connectTo) && !isExtender(d)) {
        return d.hostName
    }
    if (d.type == 0 || isExtender(d)) {
        return d.hostName
    }
    return ""
}

/**
 * 获取缓存图片
 * @param type 图片type
 */
 function getImage(type) {

    var url = imgMap[type]
    if (!imgViewMap[url]) {
        var imgView = new Image()
        imgView.src = url
        imgViewMap[url] = imgView
    }
    return url
}

/**
 * 获取节点图标尺寸
 * @param d 节点数据
 * @returns {number} 节点图标宽高
 */
 function getNodeImageSize(d) {
    var type = d.type
    var width = 60

    if (!isExpandeds(d)) { //devices
        return 0//10
    }

    // if (isExtender(d) && isIncludersInExpandeds(d)) {
    //     width = 1.5 * width
    // }

    // switch (type) {
    //     case '0':
    //         width = 1.5 * width
    //         break
    //     case '1':
    //         width = 1.5 * width
    //         break
    //     default:
    //         break
    // }
    return width
}

/**
 * 判断节点是否为展开状态
 * @param d 节点数据
 * @returns {boolean} true为展开状态，true为缩放状态
 */
 function isExpandeds(d) {
    if (parseInt(d.type) == 0 || expandeds.includes(d.connectTo) || d.groupMaster == "YES") {
        return true
    }
    return false
}

/**
 * 节点数据是否包含在已展开数据中
 * @param d 节点数据
 * @returns {boolean} true为包含 false为不包含
 */
 function isIncludersInExpandeds(d) {
    return expandeds.includes(d.macAddr)
}

/**
 * 判断设备是否为Extener
 * @param d 设备信息
 * @returns {boolean} true为Extener
 */
function isExtender(d) {
    if (parseInt(d.type) == 0 || d.groupMaster == "YES") {
        return true
    }
    return false
}

/**
 * 计算连接设备数量
 * @param d 设备信息
 * @returns {int} 数量
 */
function getConnectedDevicesNum(hostList, model) {
    var count = 0;
    for (var i = 0; i < hostList.length; i++) {
        var item = hostList[i]

        if (item.connectTo == model.macAddr) {
            count = count + 1;
        }
    }
    return count;
}

/**
 * 获取节点状态图标
 * @param d 节点信息
 * @returns {null} 根据节点信息获取到的图片
 */
 function getStatuImg(d) {
    if (d.type == "0") {
        return null
    }
    if ("4" != d.fwLevel) {
        return getImage('status_pause')
    }

    //  nodes的rssi 存在并且小于-65:error 其他:正常
    if (d.rssi != null && parseInt(d.rssi) < -65) {
        return getImage('status_warning')
    }

    var firewall = d.Firewall
    if (firewall == null) {
        return null
    }
    var timeFilter = firewall.TimeFilter
    if (firewall == null) {
        return null
    }
    var enable = timeFilter.enable
    if ('OFF' == enable) {
        return null
    }

    return calcTime(timeFilter)

}

/**
 * 根据用户设置时间和状态获取显示节点状态图标
 * @param timeFilter 节点用户设置时间数据
 * @returns {null} 根据节点信息获取到的图片
 */
function calcTime(timeFilter) {
    var tmsList = timeFilter.Tms_List
    if (tmsList == null || tmsList.length < 1) {
        return null
    }
    var tms = tmsList[0]
    if (tms.blockAllTime == "YES") {
        return getImage('status_bedtime_on')
    }

    var offset = timeFilter.tz

    var date
    if (offset == null || offset.length == 0) {
        date = new Date()
    } else {
        var d = new Date()
        var utc = d.getTime() + (d.getTimezoneOffset() * 60000)
        date = new Date(utc + (3600000 * offset))
    }

    var weekDay = date.getDay()//周几
    var hour = date.getHours()
    var minu = date.getMinutes()

    var blockedWeekdays = tms.blockedWeekdays.split('')

    var tacStartHour = parseInt(tms.tacStartHour)
    var tacStartMin = parseInt(tms.tacStartMin)
    var tacEndHour = parseInt(tms.tacEndHour)
    var tacEndMin = parseInt(tms.tacEndMin)

    if (blockedWeekdays[weekDay] == "0" || hour < tacStartHour || hour > tacEndHour) {
        return getImage('status_bedtime_off')
    }
    if (hour == tacStartHour && minu < tacStartMin) {
        return getImage('status_bedtime_off')
    }
    if (hour == tacEndHour && minu > tacEndMin) {
        return getImage('status_bedtime_off')
    }

    return getImage('status_bedtime_on')
}

/**
 * 格式化请求到的数据
 * @param hostList 请求到的节点数据
 * @returns {{}} 格式化之后节点数据
 */
 function formartRequestData(hostList) {

    var nodesData = {}
    var centerData = {}
    centerData.hostName = 'Hitron'
    centerData.type = "0"
    centerData.deviceType = "hitron"
    centerData.connectTo = "hitron"
    for (var i = 0; i < hostList.length; i++) {
        var item = hostList[i]
        var itemList = []
        var isLinkCenter = false

        item.id = item.macAddr.toLowerCase()

        var connectTo = item.connectTo.toLowerCase()
        if (connectTo == '') {
            connectTo = 'hitronAddr'
        }
        item.connectTo = connectTo


        if (isExtender(item)) {
            if (item.groupMaster == "YES") {
                item.expand = true
            }
            isLinkCenter = true
        }
        if (isLinkCenter) {
            item.type = "1"
        } else {
            item.type = "2"
        }
        item['_expanded'] = false


        if ((isLinkCenter && centerData.macAddr == null) || (i === hostList.length -1 && centerData.macAddr == null)) {
            centerData.macAddr = item.connectTo
            centerData.id = centerData.macAddr
            centerDataId = centerData.id
        }

        if (nodesData[connectTo] != null) {
            itemList = nodesData[connectTo]
        }
        itemList[itemList.length] = item
        nodesData[connectTo] = itemList
    }

    var nodes = []
    nodes[0] = centerData

    var centerModel = {}
    centerModel.nodes = [centerData]
    childData[centerData.connectTo] = centerModel


    for (var key in nodesData) {
        var itemArray = nodesData[key]
        var connectTo = itemArray[0].connectTo
        var macAddr = itemArray[0].connectTo
        // if (connectTo != centerData.macAddr) {
        var childModel = {}
        childModel.nodes = itemArray
        childData[macAddr] = childModel
        // } else {
        //     nodes = nodes.concat(itemArray)
        // }
        nodes = nodes.concat(itemArray)

    }

    var lines = []
    var source = centerData.macAddr


    while (JSON.stringify(nodesData) != '{}') {
        source = centerData.macAddr
        for (var key in nodesData) {
            var itemArray = nodesData[key]
            if (itemArray.length == 0) {
                continue
            }
            for (var i = 0; i < lines.length; i++) {
                var lineModel = lines[i]
                if (lineModel.macAddr == itemArray[0].connectTo) {
                    source = lineModel.macAddr
                    break
                }
            }
            if (lines.length == 0 && key != centerData.macAddr) {
                continue
            }
            for (var i = 0; i < itemArray.length; i++) {
                var itemModel = itemArray[i]
                var item = {}
                item.source = source
                item.target = itemModel.macAddr
                item.macAddr = itemModel.macAddr
                item.status = itemModel.status
                item.rssi = itemModel.rssi

                // if (source != centerData.macAddr) {
                var childModel = childData[source]
                var childLines = childModel.lines
                if (childLines == null) {
                    childLines = new Array()
                }
                childLines[childLines.length] = item
                childModel.lines = childLines
                // } else {
                //     lines[lines.length] = item
                // }
                lines[lines.length] = item

            }
            delete nodesData[key]
        }
    }

    var data = {}
    data.nodes = nodes
    data.lines = lines
    var hasExpert = 0;
    for (var key in childData) {
        if (key != '' && key != centerData.macAddr) {
            hasExpert ++;
        }
    }
    if (hasExpert < 2) {
        centerData['_expanded'] = true;
        expandeds[0] = centerData.macAddr
    }
    return data
}

/**
 * 获取从一个点发出过圆心直线与圆最近的交点
 * @param x 直线发出点x
 * @param y 直线发出点y
 * @param m 圆心x
 * @param n 圆心y
 * @param r 圆直径
 * @returns {null|*}
 */
 function getLeastPointOnCircleAndLine(x, y, m, n, r) {
    var points = []
    if (x == m) {
        points.push({x: x, y: n + r})
        points.push({x: x, y: n - r})
    } else {
        points = getPointsOnCircleAndLine(x, y, m, n, m, n, r)
    }
    if (points == null || points.length == 0) {
        return null
    }
    let point1 = points[0]
    if (points.length == 1) {
        return point1
    }
    let point2 = points[1]

    var distance1 = Math.sqrt(Math.pow(point1.x - x, 2) + Math.pow(point1.y - y, 2))

    var distance2 = Math.sqrt(Math.pow(point2.x - x, 2) + Math.pow(point2.y - y, 2))

    if (distance1 < distance2) {
        return point1
    }
    return point2
}

/**
 * 求圆和直线之间的交点
 * 直线方程：y = kx + b
 * 圆的方程：(x - m)² + (x - n)² = r²
 * x1, y1 = 线坐标1, x2, y2 = 线坐标2, m, n = 圆坐标, r = 半径
 */
function getPointsOnCircleAndLine(x1, y1, x2, y2, m, n, r) {
    let insertPoints = []

    let kbArr = binaryEquationGetKB(x1, y1, x2, y2)
    let k = kbArr[0]
    let b = kbArr[1]

    let aX = 1 + k * k
    let bX = 2 * k * (b - n) - 2 * m
    let cX = m * m + (b - n) * (b - n) - r * r

    let xArr = this.quadEquationGetX(aX, bX, cX)
    xArr.forEach(x => {
        let y = k * x + b
        insertPoints.push({x: x, y: y})
    })

    return insertPoints
}

/**
 * 求二元一次方程的系数
 * y1 = k * x1 + b => k = (y1 - b) / x1
 * y2 = k * x2 + b => y2 = ((y1 - b) / x1) * x2 + b
 */
function binaryEquationGetKB(x1, y1, x2, y2) {
    let a = x1 - x2
    let k = (y1 - y2) / a
    let b = (x1 * y2 - x2 * y1) / a
    return [k, b]
}


/**
 * 一元二次方程求根
 * ax² + bx + c = 0
 */
function quadEquationGetX(a, b, c) {
    let xArr = []
    let result = Math.pow(b, 2) - 4 * a * c
    if (result > 0) {
        xArr.push((-b + Math.sqrt(result)) / (2 * a))
        xArr.push((-b - Math.sqrt(result)) / (2 * a))
    } else if (result == 0) {
        xArr.push(-b / (2 * a))
    }
    return xArr
}