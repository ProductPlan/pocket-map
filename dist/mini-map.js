import React, { useState, useEffect } from "react";
import classNames from "classnames";
import $ from "jquery";
import debounce from "lodash/debounce";
import "./mini-map.scss";
export default function MiniMap({ mapTarget, wrapperClasses = "", controlClasses = "", customIcon = null, }) {
    const [showMap, setShowMap] = useState(false);
    return (React.createElement("div", { className: wrapperClasses },
        showMap && React.createElement(Map, { target: mapTarget, mapType: MapType.relative }),
        React.createElement("div", { className: "mini-map-controls" },
            React.createElement("a", { className: classNames("mini-map-control", controlClasses), title: "Show minimap", onClick: (e) => {
                    e.preventDefault();
                    setShowMap(!showMap);
                } }, customIcon ? customIcon : React.createElement(DefaultMapIcon, null)))));
}
// The map handles event listeners and a bit of state itself, ensuring that the main component remains as simple as possible
export const Map = ({ target, mapType, }) => {
    const [readyToMap, setReadyToMap] = useState(false);
    const [eventsSet, setEventsSet] = useState(false);
    const [draggingViewport, setDraggingViewport] = useState(false);
    useTargetScrollingToPositionViewport(target, draggingViewport, setReadyToMap, readyToMap);
    useEffect(() => {
        window.addEventListener("resize", debounce(() => {
            drawMap(mapType, target);
        }, 100));
    }, []);
    // Trigger map drawing/redrawing based on multiple inputs:
    // - readyToMap = the dom being ready to actually draw the map
    // - mapType = changing between types of map to draw
    // - invalidationToken = listening for events that cause the contents of the map to change, like moving bars for example
    useEffect(() => {
        if (readyToMap)
            drawMap(mapType, target);
    }, [readyToMap, mapType]);
    // On first load start a loop, checking to see if the expected dom content is in place before deciding we have content to create a map with
    useEffect(() => {
        if (!readyToMap)
            checkIfReadyToMap(target.readyIndicator, setReadyToMap);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Listen to events on the mini-map-viewport - so that we can scroll the view as well when it gets dragged
    if (readyToMap && !eventsSet) {
        setEventsSet(true);
        listenToMiniMapEvents(setDraggingViewport, target);
        positionMapFirstTime(target);
    }
    return (React.createElement("div", { id: "mini-map-wrapper" },
        React.createElement("div", { className: "mini-map-viewport" }),
        React.createElement("div", { className: "map-blocker" }),
        React.createElement("div", { id: "mini-map", className: "mini-map" })));
};
const positionMapFirstTime = (target) => {
    const event = new Event("scroll");
    $(target.scrollEl)[0].dispatchEvent(event);
};
// Use the content from the dom to determine when we are able to produce a usable map.
// There may be other approaches we can take with newer views (like eventing out when a view is finished loading)
// however for views like Timeline, which are a combination of components and jquery, there is no good indicator
// short of querying the dom and waiting for an element to show up. In this case we are looking for elements that match
// based on class name.
const checkIfReadyToMap = (readyIndicator, setReadyToMap) => {
    setTimeout(() => {
        const expectedElementsRendered = document.getElementsByClassName(readyIndicator).length > 0;
        if (expectedElementsRendered) {
            setReadyToMap(true);
        }
        else {
            checkIfReadyToMap(readyIndicator, setReadyToMap);
        }
    }, 50);
};
// Create and remove an event listener for the target element that updates the location of the viewport
// whenever scrolling occurs.
function useTargetScrollingToPositionViewport(target, draggingViewport, setReadyToMap, readyToMap) {
    const el = $(target.scrollEl);
    const handleScroll = () => {
        if (!draggingViewport) {
            const left = el.scrollLeft() || 0;
            const top = el.scrollTop() || 0;
            $(viewportSelector).css({
                marginTop: top * 0.1,
                marginLeft: left * 0.1,
            });
        }
    };
    useEffect(() => {
        el[0].addEventListener("scroll", handleScroll);
        if (!readyToMap)
            checkIfReadyToMap(target.readyIndicator, setReadyToMap);
        return () => {
            el[0].removeEventListener("scroll", handleScroll);
        };
        // In this case we don't want this firing constantly because it leaves the event handler off when we expect it to be on
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
function useWindowResizeToTriggerRedraw() { }
const drawMap = (mapType, target) => {
    Log.info("drawMap");
    if (mapType === MapType.relative) {
        drawRelativelySizedMap(target);
    }
    else {
        alert("Map type currently not supported");
    }
};
const createMappableClone = (target) => {
    // Look for the expected content and clone it
    const content = $(target.elementToMap);
    // if (!content) return null;
    const clone = content.clone();
    // Remove anything from the clone that we don't want in the map.
    // In practice this could be anything that doesn't provide useful content when scaled way down.
    // Additionally anything that needs to have it's position updated when the view scales, like titles,
    // should be removed because this is a complete copy of the dom and positioning events would also run
    // in the mini-map - which can cause memory issues.
    clone.find(".lane-title-box").empty();
    clone.find(".project-bar-title").remove();
    clone.find(".container-bar-title").remove();
    // Return the clone + some useful details about it
    return {
        clone,
        contentWidth: content[0].scrollWidth,
        contentHeight: content[0].scrollHeight,
    };
};
const drawRelativelySizedMap = (target) => {
    const { clone, contentWidth, contentHeight } = createMappableClone(target);
    const getClone = () => clone;
    // Determine the map and view window scales
    const mapWidth = contentWidth / 10;
    const mapHeight = contentHeight / 10;
    const modifier = 0.01;
    const mapCSSScale = (contentWidth / mapWidth) * modifier;
    const viewportWidth = $(target.coverWidthRef).width();
    const viewportHeight = ($(target.coverWidthRef).height() || 0) -
        ($(".floatThead-container").height() || 0);
    $(wrapperSelector).css({
        width: mapWidth,
        height: mapHeight,
        maxHeight: "",
        minHeight: "",
    });
    $("#mini-map")
        .html(getClone())
        .css({
        transform: `scale(${mapCSSScale})`,
    });
    $(viewportSelector).css({
        height: viewportHeight,
        width: viewportWidth,
    });
};
// Listen for events on the minimap itself - allowing for things like dragging the viewport and clicking on a point in the map.
const listenToMiniMapEvents = (setDraggingViewport, target) => {
    // Find the viewport element itself and any scroll from the reference element.
    // These tells us where the viewport currently is and how far it may need to move
    const viewportElement = document.querySelector(viewportSelector);
    const scrollRef = $(target.scrollEl)[0];
    const map = document.querySelector("#mini-map-wrapper");
    if (!viewportElement) {
        Log.warn("No viewportElement found");
        return;
    }
    if (!map) {
        Log.warn("No map wrapper found");
        return;
    }
    // Build out the coordinates we need to know where the mouse is now, where it is hading,
    // and where the viewport is sitting.
    let mouseStartingX;
    let mouseStartingY;
    let dragging = false;
    let viewportLeft = 0;
    let viewportTop = 0;
    // When clicking on a part of the mini-map, outside of the current viewport, move there
    map.addEventListener("mousedown", (e) => {
        // Ignore click events on the viewport - they occur when dragging
        if (e.target === viewportElement || e.target === null)
            return;
        e.preventDefault();
        setDraggingViewport(false);
        // Get click position
        var rect = e.target.getBoundingClientRect();
        var clickX = e.clientX - rect.left;
        var clickY = e.clientY - rect.top;
        // Determine offsets to center viewport there and then trigger scrolling
        const viewportRect = viewportElement.getBoundingClientRect();
        viewportLeft = clickX - viewportRect.width / 2;
        viewportTop = clickY - viewportRect.height / 2;
        $(target.scrollEl).scrollLeft(viewportLeft * 10);
        $(target.scrollEl).scrollTop(viewportTop * 10);
    });
    // On mousedown of the viewport track that we are dragging and were we started from
    viewportElement.addEventListener("mousedown", (e) => {
        dragging = true;
        setDraggingViewport(true);
        viewportElement.classList.add("active");
        mouseStartingX = e.pageX - viewportLeft;
        mouseStartingY = e.pageY - viewportTop;
    });
    // When we stop dragging the viewport put the mouse back to the way it started and disable tracking.
    const stopDragging = () => {
        dragging = false;
        setDraggingViewport(false);
        viewportElement.classList.remove("active");
    };
    // In some cases we want to stop dragging/tracking altogether, like when:
    // - the user intentionally stops dragging
    // - the user drags outside of the map, which isn't a thing
    viewportElement.addEventListener("mouseup", stopDragging);
    map.addEventListener("mouseleave", stopDragging);
    // If the mouse moves while dragging update the position of elements.
    viewportElement.addEventListener("mousemove", (e) => {
        var _a;
        if (!dragging)
            return;
        e.preventDefault();
        // Left move
        const leftMoveDiff = e.pageX - viewportLeft - mouseStartingX;
        const newViewportLeftMargin = viewportLeft + leftMoveDiff;
        // Protect against dragging off of the map
        const wouldBeOutsideRight = scrollRef.scrollLeft + scrollRef.clientWidth + leftMoveDiff >
            (((_a = viewportElement.parentElement) === null || _a === void 0 ? void 0 : _a.clientWidth) || 1) * 10;
        const wouldBeOutsideLeft = newViewportLeftMargin < 0;
        if (!wouldBeOutsideRight && !wouldBeOutsideLeft)
            viewportLeft = newViewportLeftMargin;
        // Top move
        const topMoveDiff = e.pageY - viewportTop - mouseStartingY;
        viewportTop = viewportTop + topMoveDiff;
        $(target.scrollEl).scrollLeft(viewportLeft * 10);
        $(target.scrollEl).scrollTop(viewportTop * 10);
    });
};
const Log = {
    warn: (message, ...arg) => console.warn("[MiniMap]", message, ...arg),
    info: (message, ...arg) => console.info("[MiniMap]", message, ...arg)
};
// There may be cases where a custom map icon will be passed in but for everything else this will be our default.
const DefaultMapIcon = () => (React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 576 512" },
    React.createElement("path", { d: "M384 476.1L192 421.2V35.9L384 90.8V476.1zm32-1.2V88.4L543.1 37.5c15.8-6.3 32.9 5.3 32.9 22.3V394.6c0 9.8-6 18.6-15.1 22.3L416 474.8zM15.1 95.1L160 37.2V423.6L32.9 474.5C17.1 480.8 0 469.2 0 452.2V117.4c0-9.8 6-18.6 15.1-22.3z" })));
// These should be the only map types that really make sense however for simplicity we can start with just one.
var MapType;
(function (MapType) {
    MapType[MapType["relative"] = 0] = "relative";
    // fixed = 1, // TODO: This size of the minimap is fixed and the content scales relative to the target
})(MapType || (MapType = {}));
// Common UI selectors
const viewportSelector = ".mini-map-viewport";
const wrapperSelector = "#mini-map-wrapper";
//# sourceMappingURL=mini-map.js.map