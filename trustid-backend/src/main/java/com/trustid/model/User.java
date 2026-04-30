package com.trustid.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String mobile;

    private String name;
    private String dob;
    private String kycStatus; // PENDING, VERIFIED, REJECTED

    @Column(columnDefinition = "TEXT")
    private String faceDescriptor; // JSON string of face features

    @Column(columnDefinition = "TEXT")
    private String photoBase64; // Base64 encoded captured photo

    @Column(columnDefinition = "TEXT")
    private String credential; // JSON of the verifiable credential

    @Column(columnDefinition = "TEXT")
    private String credentialSignature; // The digital signature

    @Column(columnDefinition = "TEXT")
    private String bbsCredential; // BBS+ credential data
}
