import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import { FamilyMember } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MemberNodeProps {
    member: FamilyMember;
    x: number;
    y: number;
    onPress?: (member: FamilyMember) => void;
    translateX: SharedValue<number>;
    translateY: SharedValue<number>;
    scale: SharedValue<number>;
    globalX: number;
    globalY: number;
    isFocal?: boolean;
}

const NODE_SIZE = 80;
const DEFAULT_PORTRAIT = require('@/assets/images/defaultPortrait.jpg');

export const MemberNode: React.FC<MemberNodeProps> = ({
    member, x, y, onPress,
    translateX, translateY, scale, globalX, globalY,
    isFocal
}) => {
    const isVisible = useDerivedValue(() => {
        if (globalX === undefined || globalY === undefined || isNaN(globalX) || isNaN(globalY)) {
            return true;
        }

        const transformedX = globalX * scale.value + translateX.value;
        const transformedY = globalY * scale.value + translateY.value;

        const margin = (NODE_SIZE + 20) * scale.value;

        return (
            transformedX > -margin &&
            transformedX < SCREEN_WIDTH + margin &&
            transformedY > -margin &&
            transformedY < SCREEN_HEIGHT + margin
        );
    });

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: isVisible.value ? 1 : 0,
    }));

    const isVirtual = member.id === 'virtual-root' || String(member.id).startsWith('marker-');
    const isMarker = String(member.id).startsWith('marker-');

    return (
        <Animated.View style={animatedStyle}>
            <TouchableOpacity
                style={[
                    styles.container,
                    { left: x - NODE_SIZE / 2, top: y - NODE_SIZE / 2 },
                    isFocal && styles.focalContainer,
                    isVirtual && styles.virtualContainer
                ]}
                onPress={() => !isVirtual && onPress?.(member)}
                disabled={isVirtual}
                activeOpacity={0.7}
            >
                <View style={[
                    styles.card,
                    isFocal && styles.focalCard,
                    isVirtual && styles.virtualCard,
                    isMarker && styles.markerCard
                ]}>
                    {!isVirtual && (
                        <Image
                            source={member.portrait_url ? { uri: member.portrait_url } : DEFAULT_PORTRAIT}
                            style={styles.portrait}
                            contentFit="cover"
                        />
                    )}
                    {isVirtual && (
                        <View style={styles.virtualIcon}>
                            <Ionicons
                                name={isMarker ? "arrow-forward-circle" : "people"}
                                size={isMarker ? 24 : 30}
                                color="#007AFF"
                            />
                        </View>
                    )}
                    <View style={styles.info}>
                        <Text style={[styles.name, isMarker && styles.markerName]} numberOfLines={1}>
                            {member.full_name}
                        </Text>
                        {!isVirtual && <Text style={styles.date}>{member.birth_date || 'Unknown'}</Text>}
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        width: NODE_SIZE,
        alignItems: 'center',
    },
    card: {
        width: NODE_SIZE,
        backgroundColor: '#fff',
        borderRadius: 40,
        padding: 2,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    portrait: {
        width: NODE_SIZE - 4,
        height: NODE_SIZE - 4,
        borderRadius: (NODE_SIZE - 4) / 2,
        backgroundColor: '#f0f0f0',
    },
    info: {
        marginTop: 4,
        alignItems: 'center',
    },
    name: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
    },
    date: {
        fontSize: 8,
        color: '#666',
    },
    markerName: {
        fontSize: 9,
        color: '#007AFF',
    },
    focalContainer: {
        zIndex: 10,
    },
    focalCard: {
        borderColor: '#007AFF',
        borderWidth: 2,
        shadowColor: '#007AFF',
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
    },
    virtualContainer: {
        zIndex: 1,
    },
    virtualCard: {
        backgroundColor: '#eef2f7',
        borderColor: '#007AFF',
        borderWidth: 1,
        borderStyle: 'dashed',
        height: NODE_SIZE,
        justifyContent: 'center',
    },
    virtualIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    markerCard: {
        height: 60,
        backgroundColor: '#f0f7ff',
        borderColor: '#007AFF',
        borderStyle: 'solid',
        opacity: 0.8,
    }
});
