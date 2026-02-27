import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

interface MonthPickerProps {
    selectedMonth: string; // "01" through "12"
    onSelect: (month: string) => void;
}

export const MonthPicker: React.FC<MonthPickerProps> = ({ selectedMonth, onSelect }) => {
    return (
        <View style={styles.container}>
            <View style={styles.grid}>
                {MONTHS.map((month, index) => {
                    const monthValue = (index + 1).toString().padStart(2, '0');
                    const isSelected = selectedMonth === monthValue;
                    return (
                        <TouchableOpacity
                            key={month}
                            style={[styles.monthButton, isSelected && styles.selectedButton]}
                            onPress={() => onSelect(monthValue)}
                        >
                            <Text style={[styles.monthText, isSelected && styles.selectedText]}>
                                {month}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 10,
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#eee',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    monthButton: {
        width: '23%',
        paddingVertical: 10,
        alignItems: 'center',
        marginBottom: 8,
        borderRadius: 8,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    selectedButton: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    monthText: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    selectedText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
