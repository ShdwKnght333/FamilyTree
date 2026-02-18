import { supabase } from '@/lib/supabase';
import { FamilyMember } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function AddMemberScreen() {
    const { originId, relationType } = useLocalSearchParams<{ originId: string; relationType: string }>();
    const [mode, setMode] = useState<'create' | 'link'>('create');

    // Create Mode States
    const [fullName, setFullName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [deathDate, setDeathDate] = useState('');
    const [bio, setBio] = useState('');

    // Link Mode States
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
    const [searchResults, setSearchResults] = useState<FamilyMember[]>([]);
    const [searching, setSearching] = useState(false);

    // For Child relationship (Other parent)
    const [originParentRole, setOriginParentRole] = useState<'father' | 'mother'>('father');
    const [otherParentName, setOtherParentName] = useState('');
    const [otherParentId, setOtherParentId] = useState<string | null>(null);
    const [otherParentResults, setOtherParentResults] = useState<FamilyMember[]>([]);
    const [searchingOtherParent, setSearchingOtherParent] = useState(false);

    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Effect for general member search (Link mode)
    useEffect(() => {
        if (mode === 'link' && searchQuery.length > 1) {
            const searchMembers = async () => {
                setSearching(true);
                const { data, error } = await supabase
                    .from('family_members')
                    .select('*')
                    .ilike('full_name', `%${searchQuery}%`)
                    .neq('id', originId || '')
                    .limit(10);

                if (!error && data) {
                    setSearchResults(data);
                }
                setSearching(false);
            };
            const timeout = setTimeout(searchMembers, 300);
            return () => clearTimeout(timeout);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery, mode]);

    // Effect for other parent search (Child relation)
    useEffect(() => {
        if (relationType === 'child' && otherParentName.length > 1) {
            const searchMembers = async () => {
                setSearchingOtherParent(true);
                const { data, error } = await supabase
                    .from('family_members')
                    .select('*')
                    .ilike('full_name', `%${otherParentName}%`)
                    .neq('id', originId || '')
                    .limit(5);

                if (!error && data) {
                    setOtherParentResults(data);
                }
                setSearchingOtherParent(false);
            };
            const timeout = setTimeout(searchMembers, 300);
            return () => clearTimeout(timeout);
        } else {
            setOtherParentResults([]);
        }
    }, [otherParentName, relationType]);

    // Effect to default other parent if spouse exists (Child relation)
    useEffect(() => {
        if (relationType === 'child' && originId) {
            const fetchSpouse = async () => {
                const { data: unions, error: unionError } = await supabase
                    .from('unions')
                    .select('*')
                    .or(`person1_id.eq.${originId},person2_id.eq.${originId}`)
                    .limit(1);

                if (!unionError && unions && unions.length > 0) {
                    const unionData = unions[0];
                    const spouseId = unionData.person1_id === originId ? unionData.person2_id : unionData.person1_id;
                    const { data: spouseData, error: spouseError } = await supabase
                        .from('family_members')
                        .select('*')
                        .eq('id', spouseId)
                        .single();

                    if (!spouseError && spouseData) {
                        setOtherParentId(spouseData.id);
                        setOtherParentName(spouseData.full_name);
                    }
                }
            };
            fetchSpouse();
        }
    }, [relationType, originId]);

    const handleSave = async () => {
        if (mode === 'create' && !fullName) {
            Alert.alert('Error', 'Full name is required');
            return;
        }
        if (mode === 'link' && !selectedMember) {
            Alert.alert('Error', 'Please select a member to link');
            return;
        }

        setLoading(true);
        try {
            let targetId: string;

            if (mode === 'create') {
                // 1. Create the new member
                const newMemberObj: any = {
                    full_name: fullName,
                    birth_date: birthDate || null,
                    death_date: deathDate || null,
                    bio: bio || null,
                };

                // If relationType is CHILD, we set parents immediately
                if (relationType === 'child' && originId) {
                    if (originParentRole === 'father') {
                        newMemberObj.father_id = originId;
                        newMemberObj.mother_id = otherParentId;
                    } else {
                        newMemberObj.mother_id = originId;
                        newMemberObj.father_id = otherParentId;
                    }
                }

                const { data: insertedData, error: insertError } = await supabase
                    .from('family_members')
                    .insert([newMemberObj])
                    .select()
                    .single();

                if (insertError) throw insertError;
                targetId = insertedData.id;
            } else {
                // 2. Use existing member
                targetId = selectedMember!.id;

                // For existing member, if relation is child, we might still want to update their parents
                if (relationType === 'child' && originId) {
                    const updateObj: any = {};
                    if (originParentRole === 'father') {
                        updateObj.father_id = originId;
                        updateObj.mother_id = otherParentId;
                    } else {
                        updateObj.mother_id = originId;
                        updateObj.father_id = otherParentId;
                    }
                    const { error: updateParentError } = await supabase
                        .from('family_members')
                        .update(updateObj)
                        .eq('id', targetId);
                    if (updateParentError) throw updateParentError;
                }
            }

            // 3. Link to origin (Father/Mother/Spouse)
            if (originId && relationType) {
                if (relationType === 'father') {
                    const { error: updateError } = await supabase
                        .from('family_members')
                        .update({ father_id: targetId })
                        .eq('id', originId);
                    if (updateError) throw updateError;
                } else if (relationType === 'mother') {
                    const { error: updateError } = await supabase
                        .from('family_members')
                        .update({ mother_id: targetId })
                        .eq('id', originId);
                    if (updateError) throw updateError;
                } else if (relationType === 'spouse') {
                    // Check if union already exists
                    const { data: existingUnion } = await supabase
                        .from('unions')
                        .select('*')
                        .or(`and(person1_id.eq.${originId},person2_id.eq.${targetId}),and(person1_id.eq.${targetId},person2_id.eq.${originId})`)
                        .single();

                    if (!existingUnion) {
                        const { error: unionError } = await supabase
                            .from('unions')
                            .insert([{
                                person1_id: originId,
                                person2_id: targetId,
                                type: 'marriage'
                            }]);
                        if (unionError) throw unionError;
                    }
                }
            }

            Alert.alert('Success', 'Member linked successfully');
            router.back();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <ScrollView
                style={styles.container}
                contentContainerStyle={{ paddingBottom: 100 }}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#007AFF" />
                        <Text style={styles.backText}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>
                        {relationType ? `${relationType.charAt(0).toUpperCase() + relationType.slice(1)}` : 'Add Member'}
                    </Text>
                </View>

                {/* Mode Selector */}
                {relationType && (
                    <View style={styles.modeSelector}>
                        <TouchableOpacity
                            style={[styles.modeButton, mode === 'create' && styles.modeButtonActive]}
                            onPress={() => setMode('create')}
                        >
                            <Text style={[styles.modeButtonText, mode === 'create' && styles.modeButtonTextActive]}>Create New</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modeButton, mode === 'link' && styles.modeButtonActive]}
                            onPress={() => setMode('link')}
                        >
                            <Text style={[styles.modeButtonText, mode === 'link' && styles.modeButtonTextActive]}>Link Existing</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.form}>
                    {mode === 'create' ? (
                        <>
                            <Text style={styles.label}>Full Name *</Text>
                            <TextInput
                                style={styles.input}
                                value={fullName}
                                onChangeText={setFullName}
                                placeholder="e.g. John Doe"
                            />

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={styles.label}>Birth Date</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={birthDate}
                                        onChangeText={setBirthDate}
                                        placeholder="YYYY-MM-DD"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Death Date</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={deathDate}
                                        onChangeText={setDeathDate}
                                        placeholder="YYYY-MM-DD"
                                    />
                                </View>
                            </View>

                            {relationType === 'child' && (
                                <View style={styles.relationshipBox}>
                                    <Text style={styles.subTitle}>Second Parent (Optional)</Text>
                                    <Text style={styles.labelSmall}>Your Role as parent:</Text>
                                    <View style={styles.roleContainer}>
                                        <TouchableOpacity
                                            style={[styles.roleButton, originParentRole === 'father' && styles.roleButtonActive]}
                                            onPress={() => setOriginParentRole('father')}
                                        >
                                            <Text style={[styles.roleButtonText, originParentRole === 'father' && styles.roleButtonTextActive]}>Father</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.roleButton, originParentRole === 'mother' && styles.roleButtonActive]}
                                            onPress={() => setOriginParentRole('mother')}
                                        >
                                            <Text style={[styles.roleButtonText, originParentRole === 'mother' && styles.roleButtonTextActive]}>Mother</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.labelSmall}>{originParentRole === 'father' ? 'Search for Mother:' : 'Search for Father:'}</Text>
                                    <TextInput
                                        style={styles.inputSmall}
                                        value={otherParentName}
                                        onChangeText={setOtherParentName}
                                        placeholder="Start typing name..."
                                    />
                                    {searchingOtherParent && <ActivityIndicator size="small" color="#007AFF" style={{ marginBottom: 10 }} />}

                                    {otherParentResults.map(item => (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={[styles.searchResult, otherParentId === item.id && styles.searchResultSelected]}
                                            onPress={() => {
                                                setOtherParentId(item.id);
                                                setOtherParentName(item.full_name);
                                                setOtherParentResults([]);
                                            }}
                                        >
                                            <Text style={styles.searchResultName}>{item.full_name}</Text>
                                            <Text style={styles.searchResultDate}>{item.birth_date || 'N/A'}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            <Text style={styles.label}>Bio</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={bio}
                                onChangeText={setBio}
                                placeholder="A brief biography..."
                                multiline
                            />
                        </>
                    ) : (
                        <View style={styles.linkSection}>
                            <Text style={styles.label}>Search Existing Member</Text>
                            <TextInput
                                style={styles.input}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="Type name to search..."
                            />
                            {searching && <ActivityIndicator size="small" color="#007AFF" style={{ marginBottom: 15 }} />}

                            {searchResults.map(item => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[styles.searchResult, selectedMember?.id === item.id && styles.searchResultSelected]}
                                    onPress={() => {
                                        setSelectedMember(item);
                                        setSearchQuery(item.full_name);
                                        setSearchResults([]);
                                    }}
                                >
                                    <Text style={styles.searchResultName}>{item.full_name}</Text>
                                    <Text style={styles.searchResultDate}>{item.birth_date || 'N/A'}</Text>
                                </TouchableOpacity>
                            ))}

                            {selectedMember && (
                                <View style={styles.selectedBox}>
                                    <Text style={styles.selectedLabel}>Selected:</Text>
                                    <Text style={styles.selectedName}>{selectedMember.full_name}</Text>
                                </View>
                            )}

                            {relationType === 'child' && (
                                <View style={[styles.relationshipBox, { marginTop: 20 }]}>
                                    <Text style={styles.subTitle}>Second Parent (Optional)</Text>
                                    <View style={styles.roleContainer}>
                                        <TouchableOpacity
                                            style={[styles.roleButton, originParentRole === 'father' && styles.roleButtonActive]}
                                            onPress={() => setOriginParentRole('father')}
                                        >
                                            <Text style={[styles.roleButtonText, originParentRole === 'father' && styles.roleButtonTextActive]}>Father</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.roleButton, originParentRole === 'mother' && styles.roleButtonActive]}
                                            onPress={() => setOriginParentRole('mother')}
                                        >
                                            <Text style={[styles.roleButtonText, originParentRole === 'mother' && styles.roleButtonTextActive]}>Mother</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.labelSmall}>{originParentRole === 'father' ? 'Search for Mother:' : 'Search for Father:'}</Text>
                                    <TextInput
                                        style={styles.inputSmall}
                                        value={otherParentName}
                                        onChangeText={setOtherParentName}
                                        placeholder="Start typing name..."
                                    />
                                    {searchingOtherParent && <ActivityIndicator size="small" color="#007AFF" style={{ marginBottom: 10 }} />}

                                    {otherParentResults.map(item => (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={[styles.searchResult, otherParentId === item.id && styles.searchResultSelected]}
                                            onPress={() => {
                                                setOtherParentId(item.id);
                                                setOtherParentName(item.full_name);
                                                setOtherParentResults([]);
                                            }}
                                        >
                                            <Text style={styles.searchResultName}>{item.full_name}</Text>
                                            <Text style={styles.searchResultDate}>{item.birth_date || 'N/A'}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.saveButton, loading && styles.disabledButton]}
                        onPress={handleSave}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveButtonText}>
                                {mode === 'create' ? 'Save & Link Member' : 'Link Selected Member'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
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
    form: {
        padding: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: '#333',
    },
    row: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    relationshipBox: {
        backgroundColor: '#f9f9f9',
        padding: 15,
        borderRadius: 10,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#eee',
    },
    subTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    labelSmall: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 5,
        color: '#666',
    },
    roleContainer: {
        flexDirection: 'row',
        marginBottom: 15,
    },
    roleButton: {
        flex: 1,
        padding: 10,
        borderWidth: 1,
        borderColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
        marginRight: 10,
    },
    roleButtonActive: {
        backgroundColor: '#007AFF',
    },
    roleButtonText: {
        color: '#007AFF',
        fontWeight: '600',
    },
    roleButtonTextActive: {
        color: '#fff',
    },
    inputSmall: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        marginBottom: 10,
        backgroundColor: '#fff',
    },
    searchResult: {
        padding: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    searchResultSelected: {
        backgroundColor: '#e3f2fd',
    },
    searchResultName: {
        fontSize: 14,
        fontWeight: '500',
    },
    searchResultDate: {
        fontSize: 12,
        color: '#999',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 20,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    saveButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    disabledButton: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    modeSelector: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 10,
        marginBottom: 10,
    },
    modeButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: '#eee',
    },
    modeButtonActive: {
        borderBottomColor: '#007AFF',
    },
    modeButtonText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
    },
    modeButtonTextActive: {
        color: '#007AFF',
    },
    linkSection: {
        marginTop: 10,
    },
    selectedBox: {
        backgroundColor: '#e3f2fd',
        padding: 15,
        borderRadius: 8,
        marginTop: 20,
        borderWidth: 1,
        borderColor: '#bbdefb',
    },
    selectedLabel: {
        fontSize: 12,
        color: '#1976d2',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    selectedName: {
        fontSize: 18,
        color: '#333',
        fontWeight: 'bold',
    },
});
