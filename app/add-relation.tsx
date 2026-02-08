import { Text, View } from '@/components/Themed';
import { supabase } from '@/lib/supabase';
import { FamilyMember } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

export default function AddRelationScreen() {
    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [selectedChild, setSelectedChild] = useState<string | null>(null);
    const [selectedParent, setSelectedParent] = useState<string | null>(null);
    const [parentType, setParentType] = useState<'father' | 'mother'>('father');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const { data, error } = await supabase
                    .from('family_members')
                    .select('*');
                if (error) throw error;
                setMembers(data || []);
            } catch (error: any) {
                Alert.alert('Error', error.message);
            } finally {
                setFetching(false);
            }
        };
        fetchMembers();
    }, []);

    const handleSave = async () => {
        if (!selectedChild || !selectedParent) {
            Alert.alert('Error', 'Please select both a child and a parent');
            return;
        }

        if (selectedChild === selectedParent) {
            Alert.alert('Error', 'A person cannot be their own parent');
            return;
        }

        setLoading(true);
        try {
            const updateData = parentType === 'father'
                ? { father_id: selectedParent }
                : { mother_id: selectedParent };

            const { error } = await supabase
                .from('family_members')
                .update(updateData)
                .eq('id', selectedChild);

            if (error) throw error;

            Alert.alert('Success', 'Relation added successfully');
            router.back();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    <Text style={styles.backText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Add Relation</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>1. Select Child</Text>
                <View style={styles.listContainer}>
                    {members.map(m => (
                        <TouchableOpacity
                            key={`child-${m.id}`}
                            style={[styles.item, selectedChild === m.id && styles.selectedItem]}
                            onPress={() => setSelectedChild(m.id)}
                        >
                            <Text style={[styles.itemText, selectedChild === m.id && styles.selectedItemText]}>{m.full_name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>2. Type</Text>
                <View style={styles.row}>
                    <TouchableOpacity
                        style={[styles.typeButton, parentType === 'father' && styles.selectedType]}
                        onPress={() => setParentType('father')}
                    >
                        <Text style={[styles.typeButtonText, parentType === 'father' && styles.selectedTypeText]}>Father</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.typeButton, parentType === 'mother' && styles.selectedType]}
                        onPress={() => setParentType('mother')}
                    >
                        <Text style={[styles.typeButtonText, parentType === 'mother' && styles.selectedTypeText]}>Mother</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>3. Select Parent</Text>
                <View style={styles.listContainer}>
                    {members.map(m => (
                        <TouchableOpacity
                            key={`parent-${m.id}`}
                            style={[styles.item, selectedParent === m.id && styles.selectedItem]}
                            onPress={() => setSelectedParent(m.id)}
                        >
                            <Text style={[styles.itemText, selectedParent === m.id && styles.selectedItemText]}>{m.full_name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <TouchableOpacity
                style={[styles.saveButton, loading && styles.disabledButton]}
                onPress={handleSave}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.saveButtonText}>Link Members</Text>
                )}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingTop: 60,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'absolute',
        left: 20,
        top: 60,
        zIndex: 1,
    },
    backText: {
        color: '#007AFF',
        marginLeft: 4,
        fontSize: 16,
    },
    title: {
        flex: 1,
        textAlign: 'center',
        fontSize: 20,
        fontWeight: 'bold',
    },
    section: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#333',
    },
    listContainer: {
        maxHeight: 200,
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
    },
    item: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    selectedItem: {
        backgroundColor: '#E3F2FD',
    },
    itemText: {
        fontSize: 16,
    },
    selectedItemText: {
        color: '#007AFF',
        fontWeight: 'bold',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    typeButton: {
        flex: 1,
        padding: 12,
        borderWidth: 1,
        borderColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    selectedType: {
        backgroundColor: '#007AFF',
    },
    typeButtonText: {
        color: '#007AFF',
        fontWeight: 'bold',
    },
    selectedTypeText: {
        color: '#fff',
    },
    saveButton: {
        backgroundColor: '#007AFF',
        margin: 20,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    disabledButton: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
