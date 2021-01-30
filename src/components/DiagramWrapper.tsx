/*
*  Copyright (C) 1998-2021 by Northwoods Software Corporation. All Rights Reserved.
*/

import * as go from 'gojs';
import {ReactDiagram} from 'gojs-react';
import * as React from 'react';

import {GuidedDraggingTool} from '../GuidedDraggingTool';

import './Diagram.css';

interface DiagramProps {
    nodeDataArray: Array<go.ObjectData>;
    linkDataArray: Array<go.ObjectData>;
    modelData: go.ObjectData;
    skipsDiagramUpdate: boolean;
    onDiagramEvent: (e: go.DiagramEvent) => void;
    onModelChange: (e: go.IncrementalData) => void;
    linkToPortIdProperty: string;
    linkFromPortIdProperty: string;
}

export class DiagramWrapper extends React.Component<DiagramProps, {}> {
    /**
     * Ref to keep a reference to the Diagram component, which provides access to the GoJS diagram via getDiagram().
     */
    private diagramRef: React.RefObject<ReactDiagram>;

    /** @internal */
    constructor(props: DiagramProps) {
        super(props);
        this.diagramRef = React.createRef();
    }

    /**
     * Get the diagram reference and add any desired diagram listeners.
     * Typically the same function will be used for each listener, with the function using a switch statement to handle the events.
     */
    public componentDidMount() {
        if (!this.diagramRef.current) return;
        const diagram = this.diagramRef.current.getDiagram();
        if (diagram instanceof go.Diagram) {
            diagram.addDiagramListener('ChangedSelection', this.props.onDiagramEvent);
        }
    }

    /**
     * Get the diagram reference and remove listeners that were added during mounting.
     */
    public componentWillUnmount() {
        if (!this.diagramRef.current) return;
        const diagram = this.diagramRef.current.getDiagram();
        if (diagram instanceof go.Diagram) {
            diagram.removeDiagramListener('ChangedSelection', this.props.onDiagramEvent);
        }
    }

    public render() {
        return (
            <ReactDiagram
                ref={this.diagramRef}
                divClassName='diagram-component'
                initDiagram={this.initDiagram.bind(this)}
                nodeDataArray={this.props.nodeDataArray}
                linkDataArray={this.props.linkDataArray}
                modelData={this.props.modelData}
                onModelChange={this.props.onModelChange}
                skipsDiagramUpdate={this.props.skipsDiagramUpdate}
            />
        );
    }

    /**
     * Diagram initialization method, which is passed to the ReactDiagram component.
     * This method is responsible for making the diagram and initializing the model, any templates,
     * and maybe doing other initialization tasks like customizing tools.
     * The model's data should not be set here, as the ReactDiagram component handles that.
     */
    private initDiagram(): go.Diagram {
        const $ = go.GraphObject.make;
        // set your license key here before creating the diagram: go.Diagram.licenseKey = "...";
        const diagram =
            $(go.Diagram,
                {
                    'undoManager.isEnabled': true,  // must be set to allow for model change listening
                    // 'undoManager.maxHistoryLength': 0,  // uncomment disable undo/redo functionality
                    'clickCreatingTool.archetypeNodeData': {text: 'new node', color: 'lightblue'},
                    draggingTool: new GuidedDraggingTool(),  // defined in GuidedDraggingTool.ts
                    'draggingTool.horizontalGuidelineColor': 'blue',
                    'draggingTool.verticalGuidelineColor': 'blue',
                    'draggingTool.centerGuidelineColor': 'green',
                    'draggingTool.guidelineWidth': 1,
                    layout: $(go.ForceDirectedLayout),
                    model: $(go.GraphLinksModel,
                        {
                            linkFromPortIdProperty: this.props.linkFromPortIdProperty,
                            linkKeyProperty: 'key',  // IMPORTANT! must be defined for merges and data sync when using GraphLinksModel
                            linkToPortIdProperty: this.props.linkToPortIdProperty,
                            // positive keys for nodes
                            makeUniqueKeyFunction: (m: go.Model, data: any) => {
                                let k = data.key || 1;
                                while (m.findNodeDataForKey(k)) k++;
                                data.key = k;
                                return k;
                            },
                            // negative keys for links
                            makeUniqueLinkKeyFunction: (m: go.GraphLinksModel, data: any) => {
                                let k = data.key || -1;
                                while (m.findLinkDataForKey(k)) k--;
                                data.key = k;
                                return k;
                            }
                        })
                });
        // The Panel is data bound to the item object.
        var fieldTemplate =
            $(go.Panel, "TableRow",  // this Panel is a row in the containing Table
                new go.Binding("portId", "name"),  // this Panel is a "port"
                {
                    background: "transparent",  // so this port's background can be picked by the mouse
                    fromSpot: go.Spot.Right,  // links only go from the right side to the left side
                    toSpot: go.Spot.Left,
                    // allow drawing links from or to this port:
                    fromLinkable: true, toLinkable: true
                },
                $(go.Shape,
                    {
                        width: 12, height: 12, column: 0, strokeWidth: 2, margin: 4,
                        // but disallow drawing links from or to this shape:
                        fromLinkable: false, toLinkable: false
                    },
                    new go.Binding("figure", "figure"),
                    new go.Binding("fill", "color")),
                $(go.TextBlock,
                    {
                        margin: new go.Margin(0, 5), column: 1, font: "bold 13px sans-serif",
                        alignment: go.Spot.Left,
                        // and disallow drawing links from or to this text:
                        fromLinkable: false, toLinkable: false
                    },
                    new go.Binding("text", "name")),
                $(go.TextBlock,
                    {margin: new go.Margin(0, 5), column: 2, font: "13px sans-serif", alignment: go.Spot.Left},
                    new go.Binding("text", "info"))
            );

        // define a simple Node template
        diagram.nodeTemplate =
            $(go.Node, "Auto",
                {copyable: false, deletable: false},
                new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
                // this rectangular shape surrounds the content of the node
                $(go.Shape,
                    {fill: "#EEEEEE"}),
                // the content consists of a header and a list of items
                $(go.Panel, "Vertical",
                    // this is the header for the whole node
                    $(go.Panel, "Auto",
                        {stretch: go.GraphObject.Horizontal},  // as wide as the whole node
                        $(go.Shape,
                            {fill: "#1570A6", stroke: null}),
                        $(go.TextBlock,
                            {
                                alignment: go.Spot.Center,
                                margin: 3,
                                stroke: "white",
                                textAlign: "center",
                                font: "bold 12pt sans-serif"
                            },
                            new go.Binding("text", "key"))),
                    // this Panel holds a Panel for each item object in the itemArray;
                    // each item Panel is defined by the itemTemplate to be a TableRow in this Table
                    $(go.Panel, "Table",
                        {
                            padding: 2,
                            minSize: new go.Size(100, 10),
                            defaultStretch: go.GraphObject.Horizontal,
                            itemTemplate: fieldTemplate
                        },
                        new go.Binding("itemArray", "fields")
                    )  // end Table Panel of items
                )  // end Vertical Panel
            );  // end Node

        diagram.linkTemplate =
            $(go.Link,
                {
                    relinkableFrom: true, relinkableTo: true, // let user reconnect links
                    toShortLength: 4, fromShortLength: 2
                },
                $(go.Shape, {strokeWidth: 1.5}),
                $(go.Shape, {toArrow: "Standard", stroke: null})
            );

        return diagram;
    }
}
