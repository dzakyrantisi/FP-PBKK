import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../../contexts/AuthContext";

interface Author {
  username: string;
}

interface Post {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author?: Author;
  replyToId?: string;
}

export default function ReplyToPost() {
  const [post, setPost] = useState<Post | null>(null);
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { id: postId } = router.query;
  const { user, token } = useAuth();

  useEffect(() => {
    // if (!user) {
    //   router.push("/auth/login");
    //   return;
    // }

    if (!postId) return;

    async function fetchPost() {
      try {
        const response = await fetch(`http://localhost:3000/posts/${postId}`);
        if (response.ok) {
          const postData = await response.json();
          setPost(postData);
        } else {
          router.push("/");
        }
      } catch (error) {
        console.error(error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    }

    fetchPost();
  }, [postId, router, user]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  function removeImage() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!content.trim() || !token) return;

    setIsSubmitting(true);

    try {
      let imagePath: string | undefined;

      // Upload image to S3 if selected
      if (imageFile) {
        const extensionFromName = imageFile.name.split('.').pop();
        const normalizedExtension = (extensionFromName || imageFile.type.split('/').pop() || 'jpg')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toLowerCase();

        const presignedResponse = await fetch('http://localhost:3000/s3/presigned-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileExtension: normalizedExtension || 'jpg',
            contentType: imageFile.type || 'application/octet-stream',
          }),
        });

        if (!presignedResponse.ok) {
          throw new Error("Failed to get presigned URL");
        }

        const presignedData: { uploadUrl: string; imagePath: string } =
          await presignedResponse.json();
        imagePath = presignedData.imagePath;

        // Upload file to S3
        const uploadResponse = await fetch(presignedData.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': imageFile.type || 'application/octet-stream',
          },
          body: imageFile,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload image");
        }
      }

      const replyToId =
        typeof postId === 'string' ? postId : Array.isArray(postId) ? postId[0] : undefined;

      const payload: Record<string, unknown> = { content };
      if (replyToId) {
        payload.replyToId = replyToId;
      }
      if (imagePath) {
        payload.imagePath = imagePath;
      }

      const response = await fetch('http://localhost:3000/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        router.push(`/posts/${postId}`);
      } else if (response.status === 401) {
        alert("Please login to create a reply");
        router.push("/auth/login");
      } else {
        alert("Error creating reply");
      }
    } catch (error) {
      alert(
        "Error creating reply: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!post) {
    return <div className="alert alert-danger">Post not found</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <h1>Reply to Post</h1>

      <div className="mb-4 p-3 bg-light border-start border-4 border-secondary">
        <div className="small text-muted mb-2">Replying to:</div>
        <div className="d-flex justify-content-between align-items-start mb-2">
          <strong>{post.author?.username || "Anonymous"}</strong>
          <small className="text-muted">
            {new Date(post.createdAt).toLocaleDateString()}
          </small>
        </div>
        <div>{post.content}</div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="content" className="form-label">
            Your Reply
          </label>
          <textarea
            className="form-control"
            id="content"
            rows={5}
            required
            placeholder="Write your reply here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label htmlFor="image" className="form-label">
            Image (optional)
          </label>
          <input
            type="file"
            className="form-control"
            id="image"
            accept="image/*"
            onChange={handleImageChange}
            disabled={isSubmitting}
          />
        </div>

        {imagePreview && (
          <div className="mb-3">
            <div className="position-relative" style={{ maxWidth: "400px" }}>
              <img
                src={imagePreview}
                alt="Preview"
                className="img-fluid rounded"
              />
              <button
                type="button"
                className="btn btn-sm btn-danger position-absolute top-0 end-0 m-2"
                onClick={removeImage}
                disabled={isSubmitting}
              >
                Remove
              </button>
            </div>
          </div>
        )}

        <div className="d-flex gap-2">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Posting..." : "Post Reply"}
          </button>
          <a href={`/posts/${postId}`} className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </form>
    </>
  );
}
