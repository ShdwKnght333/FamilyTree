import { supabase } from '@/lib/supabase';
import { FamilyMember } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const DEFAULT_PORTRAIT = require('@/assets/images/defaultPortrait.jpg');

export default function EditPerson() {
    const { id } = useLocalSearchParams();
    const [member, setMember] = useState<FamilyMember | null>(null);
    const [fullName, setFullName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [deathDate, setBirthDeathDate] = useState(''); // Correcting state name to match usage
    const [bio, setBio] = useState('');
    const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
    const [newImage, setNewImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const fetchPerson = async () => {
            try {
                const { data, error } = await supabase
                    .from('family_members')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                if (data) {
                    setMember(data);
                    setFullName(data.full_name);
                    setBio(data.bio || '');
                    setPortraitUrl(data.portrait_url);
                    setBirthDate(data.birth_date || '');
                    setBirthDeathDate(data.death_date || '');
                }
            } catch (error: any) {
                Alert.alert('Error', error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPerson();
    }, [id]);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setNewImage(result.assets[0]);
        }
    };

    const uploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
        const fileName = `${id}-${Date.now()}.jpg`;
        const filePath = `${fileName}`;
        const file = new File(asset.uri);
        const base64 = await file.base64();

        const { error } = await supabase.storage
            .from('portraits')
            .upload(filePath, decode(base64), {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('portraits')
            .getPublicUrl(filePath);

        return publicUrl;
    };

    const handleSave = async () => {
        if (!fullName) {
            Alert.alert('Error', 'Full name is required');
            return;
        }

        setSaving(true);
        try {
            let finalPortraitUrl = portraitUrl;
            if (newImage) {
                finalPortraitUrl = await uploadImage(newImage);
            }

            const { error } = await supabase
                .from('family_members')
                .update({
                    full_name: fullName,
                    bio: bio || null,
                    portrait_url: finalPortraitUrl,
                    birth_date: birthDate || null,
                    death_date: deathDate || null,
                })
                .eq('id', id);

            if (error) throw error;

            Alert.alert('Success', 'Profile updated successfully');
            router.back();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <ScrollView
                style={styles.container}
                contentContainerStyle={{ paddingBottom: 60 }}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Edit Profile</Text>
                    <TouchableOpacity onPress={handleSave} disabled={saving}>
                        {saving ? (
                            <ActivityIndicator size="small" color="#007AFF" />
                        ) : (
                            <Text style={styles.saveText}>Save</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.imageSection}>
                    <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
                        <Image
                            source={newImage ? { uri: newImage.uri } : (portraitUrl ? { uri: portraitUrl } : DEFAULT_PORTRAIT)}
                            style={styles.portrait}
                            contentFit="cover"
                        />
                        <View style={styles.editOverlay}>
                            <Ionicons name="camera" size={20} color="#fff" />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.changePhotoText}>Change Photo</Text>
                </View>

                <View style={styles.form}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                        style={styles.input}
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="Enter full name"
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
                                onChangeText={setBirthDeathDate}
                                placeholder="YYYY-MM-DD"
                            />
                        </View>
                    </View>

                    <Text style={styles.label}>Biography</Text>
                    <TextInput
                        style={[styles.input, styles.bioInput]}
                        value={bio}
                        onChangeText={setBio}
                        placeholder="Tell their story..."
                        multiline
                        textAlignVertical="top"
                    />
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
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    saveText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    imageSection: {
        alignItems: 'center',
        paddingVertical: 30,
        backgroundColor: '#f9f9f9',
    },
    imageContainer: {
        position: 'relative',
    },
    portrait: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#ddd',
    },
    editOverlay: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#007AFF',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    changePhotoText: {
        marginTop: 12,
        color: '#007AFF',
        fontWeight: '600',
    },
    form: {
        padding: 20,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        backgroundColor: '#f0f0f0',
        borderRadius: 10,
        padding: 15,
        fontSize: 16,
        marginBottom: 25,
    },
    bioInput: {
        height: 150,
        paddingTop: 15,
    },
});
