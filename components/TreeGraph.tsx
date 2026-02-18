import * as d3 from 'd3-hierarchy';
import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';
import { FamilyMember, TreeData } from '../types';
import { MemberNode } from './MemberNode';

interface TreeGraphProps {
    data: TreeData;
    onNodePress: (member: FamilyMember) => void;
    focalMemberId?: string | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnimatedLinkProps {
    d: string;
    strokeDasharray?: string;
    stroke?: string;
}

const AnimatedLink: React.FC<AnimatedLinkProps> = ({
    d, strokeDasharray, stroke = "#BDC3C7"
}) => {
    return (
        <Path
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeDasharray={strokeDasharray}
        />
    );
};

const CANVAS_WIDTH = 4000;
const CANVAS_HEIGHT = 1000;
const CANVAS_CENTER_X = CANVAS_WIDTH / 2;
const NODE_WIDTH = 100;
const NODE_HEIGHT = 120;

export const TreeGraph: React.FC<TreeGraphProps> = ({ data, onNodePress, focalMemberId }) => {
    const translateX = useSharedValue(SCREEN_WIDTH / 2 - CANVAS_CENTER_X);
    const translateY = useSharedValue(100);
    const scale = useSharedValue(1);

    const context = useSharedValue({ x: 0, y: 0 });

    const panGesture = Gesture.Pan()
        .onStart(() => {
            context.value = { x: translateX.value, y: translateY.value };
        })
        .onUpdate((event) => {
            translateX.value = event.translationX + context.value.x;
            translateY.value = event.translationY + context.value.y;
        });

    const pinchGesture = Gesture.Pinch()
        .onUpdate((event) => {
            scale.value = event.scale;
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    const { nodes, links } = useMemo(() => {
        try {
            const root = d3.hierarchy(data);
            const treeLayout = d3.tree<TreeData>()
                .nodeSize([NODE_WIDTH * 3.5, NODE_HEIGHT * 2.5]);

            const treeData = treeLayout(root);
            const descendants = treeData.descendants();
            const treeLinks = treeData.links();
            return {
                nodes: descendants,
                links: treeLinks,
            };
        } catch (e) {
            return { nodes: [], links: [] };
        }
    }, [data]);

    return (
        <View style={styles.container}>
            <GestureDetector gesture={Gesture.Simultaneous(panGesture, pinchGesture)}>
                <Animated.View style={[styles.graphContainer, animatedStyle]}>
                    <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={StyleSheet.absoluteFill}>
                        <G transform={`translate(${CANVAS_CENTER_X}, 200)`}>
                            {nodes.map((node) => {
                                if (node.data.spouses && node.data.spouses.length > 0) {
                                    return node.data.spouses.map((_, sIdx) => (
                                        <AnimatedLink
                                            key={`spouse-link-${node.data.id}-${sIdx}`}
                                            d={`M${node.x || 0},${node.y || 0} L${(node.x || 0) + (sIdx + 1) * 110},${node.y || 0}`}
                                            stroke="#FFA07A"
                                            strokeDasharray="5,5"
                                        />
                                    ));
                                }
                                return null;
                            })}

                            {links.map((link: d3.HierarchyLink<TreeData>, index: number) => {
                                let sourceX = link.source.x || 0;
                                const sourceY = link.source.y || 0;
                                let targetX = link.target.x || 0;
                                const targetY = link.target.y || 0;

                                const child = link.target.data;
                                const parent = link.source.data;
                                if (parent.spouses && parent.spouses.length > 0) {
                                    const otherParentIndex = parent.spouses.findIndex(s =>
                                        (child.father_id === s.id && child.mother_id === parent.id) ||
                                        (child.mother_id === s.id && child.father_id === parent.id)
                                    );
                                    if (otherParentIndex !== -1) {
                                        sourceX = sourceX + ((otherParentIndex + 1) * 110) / 2;
                                    }
                                }

                                return (
                                    <AnimatedLink
                                        key={`link-${index}`}
                                        d={`M${sourceX},${sourceY} C${sourceX},${(sourceY + targetY) / 2} ${targetX},${(sourceY + targetY) / 2} ${targetX},${targetY}`}
                                    />
                                );
                            })}
                        </G>
                    </Svg>

                    <View style={{ position: 'absolute', left: CANVAS_CENTER_X, top: 200 }}>
                        {nodes.map((node: d3.HierarchyPointNode<TreeData>, index: number) => (
                            <View
                                key={`node-container-${node.data.id}-${index}`}
                                style={{ position: 'absolute', left: node.x, top: node.y }}
                            >
                                <MemberNode
                                    member={node.data}
                                    x={0}
                                    y={0}
                                    onPress={onNodePress}
                                    isFocal={String(node.data.id) === String(focalMemberId)}
                                />
                                {node.data.spouses?.map((spouse, sIdx) => (
                                    <View
                                        key={`spouse-container-${spouse.id}`}
                                        style={{ position: 'absolute', left: (sIdx + 1) * 110, top: 0 }}
                                    >
                                        <MemberNode
                                            member={spouse}
                                            x={0}
                                            y={0}
                                            onPress={onNodePress}
                                            isFocal={String(spouse.id) === String(focalMemberId)}
                                        />
                                    </View>
                                ))}
                            </View>
                        ))}
                    </View>
                </Animated.View>
            </GestureDetector>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    graphContainer: {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
    },
});
