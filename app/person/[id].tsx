import { supabase } from '@/lib/supabase';
import { FamilyMember, Union } from '@/types';
import { buildDeepHierarchy, generateReportHTML } from '@/utils/report';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const DEFAULT_PORTRAIT = require('@/assets/images/defaultPortrait.jpg');

export default function PersonDetail() {
    const { id } = useLocalSearchParams();
    const [member, setMember] = useState<FamilyMember | null>(null);
    const [father, setFather] = useState<FamilyMember | null>(null);
    const [mother, setMother] = useState<FamilyMember | null>(null);
    const [spouses, setSpouses] = useState<FamilyMember[]>([]);
    const [children, setChildren] = useState<FamilyMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const router = useRouter();

    const fetchPersonNode = async () => {
        setLoading(true);
        try {
            // 1. Fetch current member
            const { data: personData, error: personError } = await supabase
                .from('family_members')
                .select('*')
                .eq('id', id)
                .single();

            if (personError) throw personError;
            if (personData) {
                setMember(personData);

                // 2. Fetch Father
                if (personData.father_id) {
                    const { data: fatherData } = await supabase
                        .from('family_members')
                        .select('*')
                        .eq('id', personData.father_id)
                        .single();
                    if (fatherData) setFather(fatherData);
                }

                // 3. Fetch Mother
                if (personData.mother_id) {
                    const { data: motherData } = await supabase
                        .from('family_members')
                        .select('*')
                        .eq('id', personData.mother_id)
                        .single();
                    if (motherData) setMother(motherData);
                }

                // 4. Fetch Spouses
                const { data: unionsData } = await supabase
                    .from('unions')
                    .select('*')
                    .or(`person1_id.eq.${id},person2_id.eq.${id}`);

                if (unionsData) {
                    const spouseIds = unionsData.map((u: Union) => u.person1_id === id ? u.person2_id : u.person1_id);
                    if (spouseIds.length > 0) {
                        const { data: spousesData } = await supabase
                            .from('family_members')
                            .select('*')
                            .in('id', spouseIds);
                        if (spousesData) setSpouses(spousesData);
                    }
                }

                // 5. Fetch Children
                const { data: childrenData } = await supabase
                    .from('family_members')
                    .select('*')
                    .or(`father_id.eq.${id},mother_id.eq.${id}`)
                    .order('birth_date', { ascending: true });
                if (childrenData) setChildren(childrenData);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleExportDescendants = async () => {
        if (!member) return;
        setExporting(true);
        try {
            // We need ALL members and unions to build a deep hierarchy
            const { data: allMembers } = await supabase.from('family_members').select('*');
            const { data: allUnions } = await supabase.from('unions').select('*');

            if (!allMembers || !allUnions) throw new Error('Could not fetch family data');

            const tree = buildDeepHierarchy(member, allMembers, allUnions);
            const html = generateReportHTML([tree]);

            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (error: any) {
            Alert.alert('Export Error', error.message);
        } finally {
            setExporting(false);
        }
    };

    useEffect(() => {
        fetchPersonNode();
    }, [id]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    if (!member) {
        return (
            <View style={styles.center}>
                <Text>Member not found.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.topHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Person Details</Text>
                <TouchableOpacity
                    onPress={handleExportDescendants}
                    style={styles.iconButton}
                    disabled={exporting}
                >
                    {exporting ? (
                        <ActivityIndicator size="small" color="#34C759" />
                    ) : (
                        <Ionicons name="document-text" size={24} color="#34C759" />
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => router.push(`/edit-person/${id}`)}
                    style={styles.iconButton}
                >
                    <Ionicons name="create-outline" size={24} color="#007AFF" />
                </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.profileSection}>
                    <View style={styles.portraitContainer}>
                        <Image
                            source={member.portrait_url ? { uri: member.portrait_url } : DEFAULT_PORTRAIT}
                            style={styles.largePortrait}
                            contentFit="cover"
                        />
                    </View>
                    <Text style={styles.profileName}>{member.full_name}</Text>
                    <Text style={styles.profileDates}>
                        {member.birth_date || 'Unknown'} - {member.death_date || 'Present'}
                    </Text>
                </View>

                {/* Relationship Buttons */}
                <View style={styles.relationSection}>
                    <Text style={styles.sectionTitle}>Manage Relationships</Text>
                    <View style={styles.relationButtons}>
                        <TouchableOpacity
                            style={[styles.relationButton, father && styles.disabledButton]}
                            onPress={() => !father && router.push({ pathname: '/add-member', params: { originId: member.id, relationType: 'father' } })}
                            disabled={!!father}
                        >
                            <Ionicons name="man" size={20} color={father ? '#999' : '#007AFF'} />
                            <Text style={[styles.relationButtonText, father && styles.disabledText]}>
                                {father ? 'Father Set' : 'Add Father'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.relationButton, mother && styles.disabledButton]}
                            onPress={() => !mother && router.push({ pathname: '/add-member', params: { originId: member.id, relationType: 'mother' } })}
                            disabled={!!mother}
                        >
                            <Ionicons name="woman" size={20} color={mother ? '#999' : '#007AFF'} />
                            <Text style={[styles.relationButtonText, mother && styles.disabledText]}>
                                {mother ? 'Mother Set' : 'Add Mother'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.relationButton, spouses.length > 0 && styles.disabledButton]}
                            onPress={() => spouses.length === 0 && router.push({ pathname: '/add-member', params: { originId: member.id, relationType: 'spouse' } })}
                            disabled={spouses.length > 0}
                        >
                            <Ionicons name="heart" size={20} color={spouses.length > 0 ? '#999' : '#FF2D55'} />
                            <Text style={[styles.relationButtonText, spouses.length > 0 && styles.disabledText, { color: spouses.length > 0 ? '#999' : '#FF2D55' }]}>
                                {spouses.length > 0 ? 'Spouse Set' : 'Add Spouse'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.relationButton}
                            onPress={() => router.push({ pathname: '/add-member', params: { originId: member.id, relationType: 'child' } })}
                        >
                            <Ionicons name="person" size={20} color="#007AFF" />
                            <Text style={styles.relationButtonText}>Add Child</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Existing Family List */}
                {(father || mother || spouses.length > 0 || children.length > 0) && (
                    <View style={styles.familySection}>
                        <Text style={styles.sectionTitle}>Family</Text>
                        {father && (
                            <TouchableOpacity onPress={() => router.push(`/person/${father.id}`)} style={styles.familyItem}>
                                <Text style={styles.familyRole}>Father</Text>
                                <Text style={styles.familyName}>{father.full_name}</Text>
                            </TouchableOpacity>
                        )}
                        {mother && (
                            <TouchableOpacity onPress={() => router.push(`/person/${mother.id}`)} style={styles.familyItem}>
                                <Text style={styles.familyRole}>Mother</Text>
                                <Text style={styles.familyName}>{mother.full_name}</Text>
                            </TouchableOpacity>
                        )}
                        {spouses.map(s => (
                            <TouchableOpacity key={s.id} onPress={() => router.push(`/person/${s.id}`)} style={styles.familyItem}>
                                <Text style={styles.familyRole}>Spouse</Text>
                                <Text style={styles.familyName}>{s.full_name}</Text>
                            </TouchableOpacity>
                        ))}
                        {children.map(c => (
                            <TouchableOpacity key={c.id} onPress={() => router.push(`/person/${c.id}`)} style={styles.familyItem}>
                                <Text style={styles.familyRole}>Child</Text>
                                <Text style={styles.familyName}>{c.full_name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <View style={styles.bioSection}>
                    <Text style={styles.sectionTitle}>Biography</Text>
                    <Text style={styles.bioText}>{member.bio || 'No biography available.'}</Text>
                </View>
            </ScrollView>
        </View>
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
    topHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: 45,
        paddingBottom: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#333',
    },
    iconButton: {
        padding: 8,
        width: 44,
        alignItems: 'center',
    },
    portraitContainer: {
        position: 'relative',
        marginBottom: 10,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 40,
    },
    profileSection: {
        alignItems: 'center',
        padding: 30,
        backgroundColor: '#f9f9f9',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    largePortrait: {
        width: 150,
        height: 150,
        borderRadius: 75,
        marginBottom: 20,
        backgroundColor: '#ddd',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    profileName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
    },
    profileDates: {
        fontSize: 16,
        color: '#666',
        marginTop: 8,
    },
    bioSection: {
        padding: 25,
    },
    relationSection: {
        padding: 25,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    relationButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: 5,
    },
    relationButton: {
        width: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f7ff',
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#007AFF33',
    },
    relationButtonText: {
        marginLeft: 10,
        fontSize: 15,
        color: '#007AFF',
        fontWeight: '600',
    },
    disabledButton: {
        backgroundColor: '#f5f5f5',
        borderColor: '#ddd',
    },
    disabledText: {
        color: '#999',
    },
    familySection: {
        padding: 25,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    familyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f9f9f9',
    },
    familyRole: {
        fontSize: 14,
        fontWeight: '600',
        color: '#888',
        width: 70,
    },
    familyName: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    bioText: {
        fontSize: 16,
        lineHeight: 24,
        color: '#444',
    },
});
